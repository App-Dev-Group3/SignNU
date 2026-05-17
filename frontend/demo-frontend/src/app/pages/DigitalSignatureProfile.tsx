import { useEffect, useRef, useState } from "react";
import { SignatureCanvas } from "react-signature-canvas";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { useWorkflow } from "../context/WorkflowContext";

const AUTH_TOKEN_KEY = "signnu_auth_token";
const buildAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

function SignaturePad({ onSignatureChange, onSignatureData }: {
  onSignatureChange: (hasSignature: boolean) => void;
  onSignatureData: (dataURL: string) => void;
}) {
  const sigCanvasRef = useRef<SignatureCanvas>(null);

  const clearSignature = () => {
    sigCanvasRef.current?.clear();
    onSignatureChange(false);
    onSignatureData("");
  };

  const handleEnd = () => {
    if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
      onSignatureChange(true);
      onSignatureData(sigCanvasRef.current.toDataURL());
    }
  };

  return (
    <Card className="border-dashed border-slate-200">
      <CardHeader className="items-start gap-2">
        <div>
          <CardTitle>Draw your signature</CardTitle>
          <CardDescription>Use a mouse, stylus, or finger to sign directly in the pad.</CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <SignatureCanvas
            ref={sigCanvasRef}
            penColor="black"
            canvasProps={{
              width: 420,
              height: 220,
              className: "h-[220px] w-full rounded-xl bg-white",
            }}
            onEnd={handleEnd}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button variant="outline" size="sm" onClick={clearSignature}>
          Reset drawing
        </Button>
      </CardFooter>
    </Card>
  );
}

// UploadSignature component allows users to upload an image file as their signature
function UploadSignature( { onFileChange, onFileData }: {
    onFileChange: (hasFile: boolean) => void;
    onFileData: (file: File | null) => void;
    }) {
    
    // State to store the preview URL of the uploaded file and a ref to reset the file input
    const [preview, setPreview] = useState<string>("");
    const inputRef = useRef<HTMLInputElement>(null);
    
    const previewSignature = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        
        if (file) {
            const previewURL = URL.createObjectURL(file);

            setPreview(previewURL);
            onFileChange?.(true);
            onFileData?.(file);
        }
        else {
            onFileChange?.(false);
            onFileData?.(null);
        }
    };

    const clearFile = () => {
        if (preview) {
            URL.revokeObjectURL(preview);
        }

        setPreview("");
        onFileChange(false);
        onFileData(null);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <Card className="border-dashed border-slate-200">
            <CardHeader className="items-start gap-2">
                <div>
                    <CardTitle>Upload signature image</CardTitle>
                    <CardDescription>Supported formats: PNG or JPG.</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <input
                    ref={inputRef}
                    type="file"
                    accept="image/png, image/jpeg"
                    onChange={previewSignature}
                    className="file:border-0 file:bg-primary file:text-primary-foreground file:px-4 file:py-2 file:mr-4 file:rounded-lg file:font-medium"
                />

                {preview ? (
                    <div className="space-y-3">
                        <p className="text-sm font-medium">Signature preview</p>
                        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-3">
                            <img
                                src={preview}
                                alt="Uploaded signature preview"
                                className="h-[180px] w-full object-contain"
                            />
                        </div>
                    </div>
                ) : (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-muted-foreground">
                        Select a signature file to preview it here before saving.
                    </div>
                )}
            </CardContent>
            <CardFooter>
                <Button variant="outline" size="sm" onClick={clearFile}>
                    Clear uploaded file
                </Button>
            </CardFooter>
        </Card>
    );
}

// SubmitForm component handles the submission of either the drawn signature or the uploaded file to the backend API
function SubmitForm({
    hasSignature,
    hasFile,
    signatureDataURL,
    uploadedFile,
    apiBaseURL,
    userID,
    setCurrentUserSignature,
}: {
    hasSignature: boolean;
    hasFile: boolean;
    signatureDataURL: string | null;
    uploadedFile: File | null;
    apiBaseURL: string;
    userID: string;
    setCurrentUserSignature: (signatureURL: string) => void;
}) {

    const uploadSignature = async () => {
        if (hasSignature && hasFile) {
            alert("Please clear the signature pad or remove the uploaded file before submitting.");
            return;
        } else if (!hasSignature && !hasFile) {
            alert("Please provide a signature either by drawing or uploading.");
            return;
        }

        try {
            const formData = new FormData();

            if (hasSignature && signatureDataURL) {
                formData.append("signatureData", signatureDataURL);
            } else if (hasFile && uploadedFile) {
                formData.append("signatureFile", uploadedFile);
            }

            const response = await fetch(`${apiBaseURL}/api/users/${userID}/signature`, {
                method: "PATCH",
                credentials: 'include',
                headers: {
                    ...buildAuthHeaders(),
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.error || 'Unable to upload signature.');
                console.error('Signature upload failed:', data);
                return;
            }

            if (data.signatureURL) {
                setCurrentUserSignature(data.signatureURL);
            }

            alert("Signature uploaded to Cloudinary successfully!");
        } catch (error) {
            console.error('Signature upload error:', error);
            alert('Unable to upload signature. Please try a PNG/JPG image.');
        }
    };

    const buttonDisabled = (!hasSignature && !hasFile) || (hasSignature && hasFile);
    const statusMessage = hasSignature && hasFile
        ? "Clear one option before saving. Only one source can be submitted at a time."
        : !hasSignature && !hasFile
            ? "Choose a signature file or draw your signature to enable saving."
            : "Ready to save your updated signature.";

    return (
        <Card>
            <CardHeader className="items-start gap-2">
                <div>
                    <CardTitle>Save signature</CardTitle>
                    <CardDescription>Submit the signature you chose to store it on your profile.</CardDescription>
                </div>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">{statusMessage}</p>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <Button onClick={uploadSignature} disabled={buttonDisabled} className="w-full sm:w-auto">
                    Save signature
                </Button>
                <span className="text-sm text-muted-foreground">
                    Only one signature source can be submitted at once.
                </span>
            </CardFooter>
        </Card>
    );
}

// Main component that combines the SignaturePad, UploadSignature, and SubmitForm components to create the digital signature profile page
function DigitalSignatureProfile() {
    const [hasSignature, setHasSignature] = useState(false);
    const [hasFile, setHasFile] = useState(false);
    const [signatureDataURL, setSignatureDataURL] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const { currentUser, setCurrentUserSignature } = useWorkflow();
    const apiBaseURL = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000').replace(/\/+$/, '');

    if (!currentUser) {
        return null;
    }

    const userID = currentUser.id;

    const clearCurrentSignature = async () => {
        if (!currentUser.signatureURL) return;

        try {
            const response = await fetch(`${apiBaseURL}/api/users/${userID}`, {
                method: 'PATCH',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json',
                    ...buildAuthHeaders(),
                },
                body: JSON.stringify({ signatureURL: '' }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Unable to clear saved signature.');
                return;
            }

            setCurrentUserSignature('');
            setHasSignature(false);
            setHasFile(false);
            setSignatureDataURL(null);
            setUploadedFile(null);
            alert('Saved signature cleared. You can now upload a new one.');
        } catch (error) {
            console.error('Clear signature failed:', error);
            alert('Unable to clear saved signature.');
        }
    };

    return (
        <div className="mx-auto max-w-6xl space-y-8 px-4 py-6 sm:px-6 lg:px-8">
            <div className="space-y-2">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Signature settings</p>
                <h1 className="scroll-m-20 text-3xl font-bold tracking-tight">Digital Signature Profile</h1>
                <p className="max-w-3xl text-base text-muted-foreground">
                    Upload a new signature image or draw your signature on the pad. Your saved signature is used when signing forms and documents.
                </p>
            </div>

            <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
                <div className="space-y-6">
                    <Card>
                        <CardHeader className="items-center gap-2">
                            <div>
                                <CardTitle>Current saved signature</CardTitle>
                                <CardDescription>Preview your currently stored signature.</CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={clearCurrentSignature}
                                disabled={!currentUser.signatureURL}
                            >
                                Clear saved signature
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {currentUser.signatureURL ? (
                                <div className="space-y-4">
                                    <div className="overflow-hidden rounded-3xl border border-slate-200 bg-slate-50 p-4">
                                        <img
                                            src={currentUser.signatureURL}
                                            alt="Current uploaded signature"
                                            className="h-56 w-full object-contain"
                                        />
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Your current signature is ready to use across SignNU.
                                    </p>
                                </div>
                            ) : (
                                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-muted-foreground">
                                    No uploaded signature found yet. Upload an image or draw below to save your signature.
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <div className="grid gap-6 lg:grid-cols-2">
                        <UploadSignature onFileChange={setHasFile} onFileData={setUploadedFile} />
                        <SignaturePad onSignatureChange={setHasSignature} onSignatureData={setSignatureDataURL} />
                    </div>
                </div>

                <SubmitForm
                    hasSignature={hasSignature}
                    hasFile={hasFile}
                    signatureDataURL={signatureDataURL}
                    uploadedFile={uploadedFile}
                    apiBaseURL={apiBaseURL}
                    userID={userID}
                    setCurrentUserSignature={setCurrentUserSignature}
                />
            </div>
        </div>
    );
}

export default DigitalSignatureProfile;