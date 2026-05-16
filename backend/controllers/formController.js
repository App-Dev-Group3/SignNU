const Form = require('../models/form.js');
const User = require('../models/user.js');
const cloudinary = require('cloudinary').v2;
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const { Resend } = require('resend');
const fetch = globalThis.fetch || ((...args) => require('node-fetch')(...args));

const emitToUser = (req, userId, event, payload) => {
  try {
    const io = req.app?.get('io');
    if (!io || !userId) return;
    io.to(`user:${String(userId)}`).emit(event, payload);
  } catch (error) {
    console.warn(`Socket emit failed for ${event} to user:${userId}`, error?.message || error);
  }
};

const emitFormToUsers = (req, form, event = 'form:updated') => {
  try {
    const io = req.app?.get('io');
    if (!io || !form) return;
    const userIds = new Set();
    if (form.submittedById) userIds.add(String(form.submittedById));
    if (Array.isArray(form.approvalSteps)) {
      form.approvalSteps.forEach((step) => {
        if (step?.userId) userIds.add(String(step.userId));
      });
    }
    userIds.forEach((userId) => io.to(`user:${userId}`).emit(event, form));
  } catch (error) {
    console.warn(`Socket emit failed for form event ${event}`, error?.message || error);
  }
};

const resendClient = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const EMAIL_FROM = process.env.EMAIL_FROM || 'SignNU <no-reply@signnu.work>';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

cloudinary.config({
  secure: true,
});

const NUDGE_INTERVAL_MS = 8 * 60 * 60 * 1000;

const formatCooldown = (ms) => {
  const totalMinutes = Math.ceil(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
};

const nudgeApprover = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const form = await Form.findOne({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.status !== 'pending') {
      return res.status(400).json({ error: 'Only pending forms can be nudged.' });
    }

    const isRequester = String(user.id) === String(form.submittedById);
    const isAdminUser = user.role === 'Admin';

    if (!isRequester && !isAdminUser) {
      return res.status(403).json({ error: 'Only the request owner or an admin can nudge the approver.' });
    }

    const now = new Date();
    const requesterNudgeAt = form.lastRequesterNudgedAt ? new Date(form.lastRequesterNudgedAt) : null;
    const adminNudgeAt = form.lastAdminNudgedAt ? new Date(form.lastAdminNudgedAt) : null;

    if (isAdminUser) {
      if (adminNudgeAt && adminNudgeAt.getTime() + NUDGE_INTERVAL_MS > now.getTime()) {
        const remaining = adminNudgeAt.getTime() + NUDGE_INTERVAL_MS - now.getTime();
        return res.status(400).json({ error: `Admin can only nudge again after ${formatCooldown(remaining)}.` });
      }
      form.lastAdminNudgedAt = now.toISOString();
    } else {
      if (requesterNudgeAt && requesterNudgeAt.getTime() + NUDGE_INTERVAL_MS > now.getTime()) {
        const remaining = requesterNudgeAt.getTime() + NUDGE_INTERVAL_MS - now.getTime();
        return res.status(400).json({ error: `You can only nudge again after ${formatCooldown(remaining)}.` });
      }
      form.lastRequesterNudgedAt = now.toISOString();
    }

    form.lastNudgedAt = now.toISOString();

    const pendingSteps = form.approvalSteps.filter((step) => step.status === 'pending');
    const pendingUserIds = pendingSteps.map((step) => step.userId);
    const approvers = await User.find({ _id: { $in: pendingUserIds } });

    await Promise.all(
      approvers.map(async (approver) => {
        if (!approver.email) return;

        const actorName = user.name || user.username || user.email || 'Someone';
        const message = `${actorName} has nudged you to review the pending request "${form.title}".`;

        if (resendClient) {
          try {
            await resendClient.emails.send({
              from: EMAIL_FROM,
              to: approver.email,
              subject: `SignNU Reminder: Review ${form.title}`,
              html: `<p>${message}</p><p><a href="${FRONTEND_URL}/forms/${form.id}">Open request</a></p>`,
            });
          } catch (sendError) {
            console.warn(`Failed to send nudge email to ${approver.email}:`, sendError);
          }
        }

        const notification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          formId: form.id,
          userId: approver._id.toString(),
          message,
          read: false,
          createdAt: new Date(),
        };

        approver.notifications = [notification, ...(approver.notifications || [])];
        await approver.save();
        emitToUser(req, approver._id, 'notification:new', notification);
      })
    );

    await form.save();

    return res.status(200).json({
      message: 'Approver nudged successfully.',
      form,
    });
  } catch (error) {
    console.error('Nudge approver failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

const notifyApprover = async (req, res) => {
  const { id } = req.params;
  const user = req.user;

  try {
    const form = await Form.findOne({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    const isRequester = String(user.id) === String(form.submittedById);
    const isAdminUser = user.role === 'Admin';
    if (!isRequester && !isAdminUser) {
      return res.status(403).json({ error: 'Only the requester or an admin can notify the approver.' });
    }

    const pendingSteps = form.approvalSteps.filter((step) => step.status === 'pending');
    const pendingUserIds = pendingSteps.map((step) => step.userId);
    const approvers = await User.find({ _id: { $in: pendingUserIds } });

    await Promise.all(
      approvers.map(async (approver) => {
        if (!approver.email) return;

        const actorName = user.name || user.username || user.email || 'Someone';
        const message = `A new request "${form.title}" is waiting for your approval.`;

        if (resendClient) {
          try {
            await resendClient.emails.send({
              from: EMAIL_FROM,
              to: approver.email,
              subject: `SignNU: New request ${form.title}`,
              html: `<p>${message}</p><p><a href="${FRONTEND_URL}/forms/${form.id}">Review the request</a></p>`,
            });
          } catch (sendError) {
            console.warn(`Failed to send notification email to ${approver.email}:`, sendError);
          }
        }

        const notification = {
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          formId: form.id,
          userId: approver._id.toString(),
          message,
          read: false,
          createdAt: new Date(),
        };

        approver.notifications = [notification, ...(approver.notifications || [])];
        await approver.save();
        emitToUser(req, approver._id, 'notification:new', notification);
      })
    );

    return res.status(200).json({
      message: 'Approver notification email sent successfully.',
      form,
    });
  } catch (error) {
    console.error('Notify approver failed:', error);
    return res.status(500).json({ error: error.message });
  }
};

const parseDataUrl = (dataUrl) => {
  const match = dataUrl.match(/^data:(.+);base64,(.+)$/);
  if (!match) {
    throw new Error('Invalid data URL');
  }
  return {
    mimeType: match[1],
    data: Buffer.from(match[2], 'base64'),
  };
};

const resolveImageSource = async (source) => {
  if (!source) return null;
  if (source.startsWith('data:')) {
    return parseDataUrl(source);
  }

  const res = await fetch(source);
  if (!res.ok) {
    throw new Error(`Unable to fetch image from URL: ${source}`);
  }
  const mimeType = res.headers.get('content-type') || '';
  const arrayBuffer = await res.arrayBuffer();
  return { mimeType, data: Buffer.from(arrayBuffer) };
};

const uploadPdfToCloudinary = (buffer, formId, originalName) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        resource_type: 'raw',
        folder: `pdfs/${formId}`,
        public_id: `filled_${Date.now()}`,
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

const getAllForms = async (req, res) => {
  const user = req.user;
  try {
    const query = {
      $or: [
        { status: { $ne: 'draft' } },
        { submittedById: String(user.id) },
      ],
    };

    const forms = await Form.find(query).sort({ created_at: -1 });
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFormById = async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  try {
    const form = await Form.findOne({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (form.status === 'draft' && String(form.submittedById) !== String(user.id)) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ error: 'Invalid ID format' });
  }
};

const createForm = async (req, res) => {
  try {
    const form = await Form.create(req.body);
    emitFormToUsers(req, form, 'form:updated');
    res.status(201).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateForm = async (req, res) => {
  const { id } = req.params;
  const user = req.user;
  try {
    const existingForm = await Form.findOne({ id });
    if (!existingForm) {
      return res.status(404).json({ error: 'Form not found' });
    }

    if (
      existingForm.status === 'draft' &&
      req.body.status === 'pending' &&
      String(user.id) !== String(existingForm.submittedById)
    ) {
      return res.status(403).json({ error: 'Only the requester can submit this draft.' });
    }

    const form = await Form.findOneAndUpdate({ id }, { ...req.body }, { new: true, runValidators: true });
    emitFormToUsers(req, form, 'form:updated');
    res.status(200).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteForm = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOneAndDelete({ id });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
    res.status(200).json({ message: 'Form deleted successfully', form });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const generatePdf = async (req, res) => {
  const { id } = req.params;
  const pdfFile = req.file;
  const body = req.body || {};

  if (!pdfFile) {
    return res.status(400).json({ error: 'PDF file is required as pdfFile' });
  }

  let textFields = {};
  let annotations = [];
  try {
    textFields = body.textFields ? JSON.parse(body.textFields) : {};
    annotations = body.annotations ? JSON.parse(body.annotations) : [];
  } catch (error) {
    return res.status(400).json({ error: 'Invalid JSON for textFields or annotations' });
  }

  try {
    const pdfDoc = await PDFDocument.load(pdfFile.buffer);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const pages = pdfDoc.getPages();
    const firstPage = pages[0];
    const { width, height } = firstPage.getSize();

    let offsetY = height - 80;
    const fieldEntries = Object.entries(textFields);

    fieldEntries.forEach(([key, value], index) => {
      const text = `${key}: ${value ?? ''}`;
      firstPage.drawText(text, {
        x: 50,
        y: offsetY - index * 20,
        size: 12,
        font,
        color: rgb(0, 0, 0),
      });
    });

    const getPage = (pageNumber) => {
      if (!pageNumber || pageNumber < 1 || pageNumber > pages.length) {
        return pages[0];
      }
      return pages[pageNumber - 1];
    };

    const drawAnnotation = async (annotation) => {
      const page = getPage(annotation.page);
      const { width: pageWidth, height: pageHeight } = page.getSize();
      const x = annotation.xPct * pageWidth;
      const y = pageHeight - annotation.yPct * pageHeight;
      const boxWidth = annotation.widthPct * pageWidth;
      const boxHeight = annotation.heightPct * pageHeight;

      if (annotation.type === 'text') {
        page.drawText(annotation.text || 'Text', {
          x,
          y: y - 14,
          size: 12,
          font,
          color: rgb(0, 0, 0),
        });
        return;
      }

      if (annotation.signatureData) {
        try {
          const resolved = await resolveImageSource(annotation.signatureData);
          if (resolved) {
            const { mimeType, data } = resolved;
            let image;
            if (mimeType === 'image/png') {
              image = await pdfDoc.embedPng(data);
            } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
              image = await pdfDoc.embedJpg(data);
            }

            if (image) {
              page.drawImage(image, {
                x,
                y: y - boxHeight,
                width: boxWidth,
                height: boxHeight,
              });
              return;
            }
          }
        } catch (error) {
          console.warn('Unable to embed signature image, falling back to placeholder', error);
        }
      }

      page.drawRectangle({
        x,
        y: y - boxHeight,
        width: boxWidth,
        height: boxHeight,
        borderColor: rgb(0.2, 0.2, 0.7),
        borderWidth: 1,
        color: rgb(0.9, 0.9, 1),
      });
      page.drawText(annotation.text || 'SIGN HERE', {
        x: x + 4,
        y: y - 18,
        size: 12,
        font,
        color: rgb(0.1, 0.1, 0.5),
      });
    };

    for (const annotation of annotations) {
      await drawAnnotation(annotation);
    }

    const stampSignature = async (dataUrlOrUrl, x, y, widthPx, heightPx) => {
      if (!dataUrlOrUrl) return;
      const resolved = await resolveImageSource(dataUrlOrUrl);
      if (!resolved) return;
      const { mimeType, data } = resolved;
      let image;
      if (mimeType === 'image/png') {
        image = await pdfDoc.embedPng(data);
      } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
        image = await pdfDoc.embedJpg(data);
      } else {
        throw new Error('Unsupported signature image type');
      }
      firstPage.drawImage(image, {
        x,
        y,
        width: widthPx,
        height: heightPx,
      });
    };

    await stampSignature(body.ownerSignature, 50, 180, 180, 60);
    await stampSignature(body.assignedSignature, width - 240, 180, 180, 60);

    const finalPdfBytes = await pdfDoc.save();
    const uploadResult = await uploadPdfToCloudinary(finalPdfBytes, id, pdfFile.originalname);

    const attachmentId = body.attachmentId;
    const updateOps = {
      $set: {
        generatedPdfURL: uploadResult.secure_url,
      },
    };

    if (attachmentId) {
      updateOps.$set['attachments.$[att].url'] = uploadResult.secure_url;
      updateOps.$set['attachments.$[att].name'] = `filled_${pdfFile.originalname}`;
      updateOps.$set['attachments.$[att].size'] = finalPdfBytes.length;
      updateOps.$set['attachments.$[att].type'] = 'application/pdf';
    } else {
      updateOps.$push = {
        attachments: {
          id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
          name: `filled_${pdfFile.originalname}`,
          size: finalPdfBytes.length,
          type: 'application/pdf',
          url: uploadResult.secure_url,
        },
      };
    }

    const updatedForm = await Form.findOneAndUpdate(
      { id },
      updateOps,
      {
        new: true,
        arrayFilters: attachmentId ? [{ 'att.id': attachmentId }] : undefined,
      }
    );

    if (!updatedForm) {
      return res.status(404).json({ error: 'Form not found' });
    }

    res.status(200).json({
      message: 'PDF updated successfully',
      pdfURL: uploadResult.secure_url,
      form: updatedForm,
    });
  } catch (error) {
    console.error('PDF generation failed:', error);
    res.status(500).json({ error: error.message || 'Failed to generate PDF' });
  }
};

module.exports = {
  getAllForms,
  getFormById,
  createForm,
  updateForm,
  deleteForm,
  generatePdf,
  nudgeApprover,
  notifyApprover,
};
