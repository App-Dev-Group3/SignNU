import { useEffect, useRef, useState } from "react";
import { SignatureCanvas } from "react-signature-canvas";
import { useWorkflow } from "../context/WorkflowContext";

// SignaturePad component allows users to draw their signature
function SignaturePad({ onSignatureChange, onSignatureData }: { 
    onSignatureChange: (hasSignature: boolean) => void;
    onSignatureData: (dataURL: string) => void;
    }) {

    // Ref to access the SignatureCanvas instance for clearing and getting dataURL of the drawn signature
    const sigCanvasRef = useRef<SignatureCanvas>(null);

    const clearSignature = () => {
        sigCanvasRef.current?.clear();
        onSignatureChange?.(false);
        onSignatureData?.("");
    };

    const handleEnd = () => {
        if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
            onSignatureChange?.(true);
            onSignatureData?.(sigCanvasRef.current.toDataURL());
        }  
    };

    return (
        <div style={{ padding: "20px" }}>
        <h2>Signature Pad</h2>

        <div
            style={{
            border: "1px solid #ccc",
            width: "400px",
            height: "200px",
            marginBottom: "10px",
            }}
        >
            <SignatureCanvas
            ref={sigCanvasRef}
            penColor="black"
            canvasProps={{
                width: 400,
                height: 200,
                className: "signature-canvas",
            }}

            // Call handleEnd when the user finishes drawing to update the signature data and state
            onEnd={handleEnd}
            />
        </div>

        <button onClick={clearSignature} style={{ marginRight: "10px" }}>
            Clear
        </button>

        </div>
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
        setPreview("");
        onFileChange(false);
        onFileData?.(null);

        if (inputRef.current) {
            inputRef.current.value = "";
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <input type="file" accept="image/*" onChange={previewSignature} ref={inputRef} />
            <button onClick={clearFile}>Clear File</button>

            {preview && (
                <div style={{ marginTop: "20px" }}>
                <h3>Signature Preview</h3>
                <img
                    src={preview}
                    style={{ border: "1px solid #ccc", maxWidth: "400px" }}
                />
                </div>
            )}
        </div>
    );
}

// SubmitForm component handles the submission of either the drawn signature or the uploaded file to the backend API
function SubmitForm({ 
    hasSignature, hasFile,
    signatureDataURL, uploadedFile,
    apiBaseURL, userID,
    setCurrentUserSignature,
    }: { 
    hasSignature: boolean; hasFile: boolean; 
    signatureDataURL: string | null; uploadedFile: File | null; 
    apiBaseURL: string; userID: string;
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
            }
            else if (hasFile && uploadedFile) {
                formData.append("signatureFile", uploadedFile);
            }

            const response = await fetch(`${apiBaseURL}/api/users/${userID}/signature`, {
                method: "PATCH",
                credentials: 'include',
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
            return;
        }
    };

    return (
        <div style={{ padding: "20px" }}>
            <button onClick={uploadSignature}>Submit Form</button>    
        </div>
    );
}

// Main component that combines the SignaturePad, UploadSignature, and SubmitForm components to create the digital signature profile page
function DigitalSignatureProfile() {
    const [hasSignature, setHasSignature] = useState(false);
    const [hasFile, setHasFile] = useState(false);
    const [signatureDataURL, setSignatureDataURL] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const { currentUser, setCurrentUserSignature } = useWorkflow();
    const apiBaseURL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

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
                },
                body: JSON.stringify({ signatureURL: '' }),
            });

            if (!response.ok) {
                const data = await response.json();
                alert(data.error || 'Unable to clear saved signature.');
                return;
            }

            setCurrentUserSignature('');
            alert('Saved signature cleared. You can now upload a new one.');
        } catch (error) {
            console.error('Clear signature failed:', error);
            alert('Unable to clear saved signature.');
        }
    };

    return (
        <div style={{ padding: '20px' }}>
            <h1>Modify Signature</h1>
            <p style={{ marginBottom: '20px' }}>
                Upload your signature image here. If you prefer, you can still draw your signature below.
            </p>

            {currentUser.signatureURL ? (
                <div style={{ marginBottom: '20px', padding: '16px', border: '1px solid #ddd', borderRadius: '12px', maxWidth: '420px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h2 style={{ margin: 0 }}>Current Uploaded Signature</h2>
                        <button onClick={clearCurrentSignature} style={{ padding: '8px 12px', border: '1px solid #ccc', borderRadius: '8px', background: '#fff', cursor: 'pointer' }}>
                            Clear Saved Signature
                        </button>
                    </div>
                    <img
                        src={currentUser.signatureURL}
                        alt="Current uploaded signature"
                        style={{ width: '100%', maxWidth: '400px', border: '1px solid #ccc', borderRadius: '8px' }}
                    />
                </div>
            ) : (
                <div style={{ marginBottom: '20px', color: '#555' }}>
                    <strong>No uploaded signature found yet.</strong> Use the upload field below to add one.
                </div>
            )}

            <UploadSignature
                onFileChange={setHasFile}
                onFileData={setUploadedFile}
            />

            <div style={{ marginTop: '40px', marginBottom: '20px' }}>
                <p style={{ fontWeight: '600' }}>Or draw your signature</p>
            </div>

            <SignaturePad 
                onSignatureChange={setHasSignature}
                onSignatureData={setSignatureDataURL}
            />

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
    );
}

export default DigitalSignatureProfile;