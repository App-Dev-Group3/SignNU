const Form = require('../models/form.js');
const cloudinary = require('cloudinary').v2;
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fetch = globalThis.fetch || ((...args) => require('node-fetch')(...args));

cloudinary.config({
  secure: true,
});

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
  try {
    const forms = await Form.find({}).sort({ created_at: -1 });
    res.status(200).json(forms);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

const getFormById = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOne({ id });
    if (!form) {
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
    res.status(201).json(form);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateForm = async (req, res) => {
  const { id } = req.params;
  try {
    const form = await Form.findOneAndUpdate({ id }, { ...req.body }, { new: true, runValidators: true });
    if (!form) {
      return res.status(404).json({ error: 'Form not found' });
    }
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

    const updatedForm = await Form.findOneAndUpdate(
      { id },
      {
        $set: { generatedPdfURL: uploadResult.secure_url },
        $push: {
          attachments: {
            id: `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
            name: `filled_${pdfFile.originalname}`,
            size: finalPdfBytes.length,
            type: 'application/pdf',
            url: uploadResult.secure_url,
          },
        },
      },
      { new: true }
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
};
