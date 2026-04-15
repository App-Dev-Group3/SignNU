import { useEffect, useRef, useState } from "react";
import { SignatureCanvas } from "react-signature-canvas";

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
    apiBaseURL, userID
    }: { 
    hasSignature: boolean; hasFile: boolean; 
    signatureDataURL: string | null; uploadedFile: File | null; 
    apiBaseURL: string; userID: string;
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
                body: formData
            });

            const data = await response.json();

            if (!response.ok) {
                console.log(data.error);  
                
                return;
            }

        } catch (error) {
            console.log(error);

            return;
        }

        alert("Signature uploaded to Cloudinary successfully!");
    };

    return (
        <div style={{ padding: "20px" }}>
            <button onClick={uploadSignature}>Submit Form</button>    
        </div>
    );
}

// Custom hook to fetch user credentials (API base URL and user ID) when the component mounts
function useUserCredentials( 
    onAPIBaseURL: (apiBaseURL: string) => void,
    onUserID: (userID: string) => void
    ) {
    
    // useEffect to fetch the API base URL and user ID from the backend when the component mounts
    // and pass them to the parent component via the provided callback functions
    useEffect(() => {
        const fetchUserData = async () => {
            const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

            if (!API_BASE_URL) {
                alert("API_BASE_URL is not defined!");

                return;
            }

            const response = await fetch(`${API_BASE_URL}/api/users/me`, {
            credentials: 'include',
            });

            const data = await response.json();
            
            onAPIBaseURL(API_BASE_URL);
            onUserID(data.user._id);
        };

        fetchUserData();
    }, []);
}

// Main component that combines the SignaturePad, UploadSignature, and SubmitForm components to create the digital signature profile page
function DigitalSignatureProfile() {
    const [hasSignature, setHasSignature] = useState(false);
    const [hasFile, setHasFile] = useState(false);
    const [signatureDataURL, setSignatureDataURL] = useState<string | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [apiBaseURL, setAPIBaseURL] = useState<string>(""); 
    const [userID, setUserID] = useState<string>("");

    useUserCredentials(setAPIBaseURL, setUserID );

    return (
        <div>
            <SignaturePad 
                onSignatureChange={setHasSignature}
                onSignatureData={setSignatureDataURL}
            />
            <UploadSignature
                onFileChange={setHasFile}
                onFileData={setUploadedFile}
            />
            <SubmitForm 
                hasSignature={hasSignature} 
                hasFile={hasFile} 
                signatureDataURL={signatureDataURL}
                uploadedFile={uploadedFile}
                apiBaseURL={apiBaseURL}
                userID={userID}
            />
        </div>
    );
}

export default DigitalSignatureProfile;