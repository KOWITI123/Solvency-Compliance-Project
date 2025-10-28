import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CloudUpload, FileText, X, ArrowRight, SkipForward, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

export function FileUploadPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleFileSelection = (file: File) => {
    // ✅ INCREASED: From 10MB to 100MB for financial statements
    const maxSize = 100 * 1024 * 1024; // 100MB
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (file.size > maxSize) {
      toast.error('File too large (max 100MB)', {
        description: 'Please compress your file or contact support for assistance'
      });
      return;
    }
    
    if (!allowedTypes.includes(file.type)) {
      toast.error('Invalid file type', {
        description: 'Only PDF, Excel, and Word documents are allowed'
      });
      return;
    }
    
    setSelectedFile(file);
    
    try {
      const fileData = {
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified
      };
      sessionStorage.setItem('selectedFile', JSON.stringify(fileData));
      
      // ✅ IMPROVED: Only store small files in sessionStorage
      // Large files will be handled during actual upload
      if (file.size < 5 * 1024 * 1024) { // Only for files < 5MB
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            sessionStorage.setItem('fileContent', e.target.result as string);
          }
        };
        reader.readAsDataURL(file);
      } else {
        // For larger files, we'll handle them during form submission
        sessionStorage.setItem('largeFile', 'true');
        toast.info('Large file detected', {
          description: 'File will be processed during submission'
        });
      }
      
      toast.success(`📄 ${file.name} ready for processing`);
    } catch (error) {
      console.error('Error storing file:', error);
      toast.error('Error storing file data');
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      handleFileSelection(files[0]);
    }
  };

  const handleNext = () => {
    navigate('/app/data-input-form');
  };

  const handleSkip = () => {
    sessionStorage.removeItem('selectedFile');
    sessionStorage.removeItem('fileData');
    sessionStorage.removeItem('fileContent');
    sessionStorage.removeItem('largeFile');
    navigate('/app/data-input-form');
  };

  const handleClearFile = () => {
    setSelectedFile(null);
    sessionStorage.removeItem('selectedFile');
    sessionStorage.removeItem('fileData');
    sessionStorage.removeItem('fileContent');
    sessionStorage.removeItem('largeFile');
    toast.info('File cleared');
  };

  // ✅ Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // ✅ Check if file is large
  const isLargeFile = selectedFile && selectedFile.size > 50 * 1024 * 1024; // 50MB+

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">Upload Financial Statement</h1>
        <p className="text-muted-foreground mt-2">
          Upload your financial statement for AI-powered data extraction (optional)
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Step 1: Document Upload</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.xlsx,.xls,.doc,.docx"
            onChange={handleFileChange}
            style={{ display: 'none' }}
            aria-label="File upload input"
          />
          
          {!selectedFile ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
                isDragOver 
                  ? "border-blue-400 bg-blue-50 border-solid" 
                  : "border-gray-300 hover:bg-gray-50 hover:border-gray-400"
              }`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
            >
              <CloudUpload className="mx-auto h-16 w-16 text-gray-400 mb-4" />
              <p className="text-lg font-medium text-gray-900 mb-2">
                {isDragOver ? "Drop file here" : "Click to upload or drag & drop"}
              </p>
              <p className="text-sm text-gray-500">
                PDF, Excel, Word documents • Max 100MB
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <div className="flex items-center gap-3">
                  <FileText className="h-8 w-8 text-green-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-green-800 truncate">{selectedFile.name}</p>
                    <p className="text-sm text-green-600">
                      {formatFileSize(selectedFile.size)} • Ready for AI processing
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearFile}
                    className="h-8 w-8 p-0 flex-shrink-0"
                    aria-label="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* ✅ Warning for large files */}
              {isLargeFile && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium text-amber-800">Large File Detected</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Processing may take longer. Ensure stable internet connection during upload.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="flex gap-3">
            <Button onClick={handleSkip} variant="outline" className="flex-1">
              <SkipForward className="mr-2 h-4 w-4" />
              Skip Upload
            </Button>
            <Button onClick={handleNext} className="flex-1">
              <ArrowRight className="mr-2 h-4 w-4" />
              {selectedFile ? 'Continue with File' : 'Continue without File'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ✅ Updated info card with new limits */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CloudUpload className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-medium text-blue-900 mb-1">AI Data Extraction</h3>
              <p className="text-sm text-blue-700 mb-2">
                Upload your financial statement to automatically extract compliance data using AI. 
                This will help pre-fill your submission form and ensure accuracy.
              </p>
              <div className="text-xs text-blue-600 space-y-1">
                <p>• Supported formats: PDF, Excel (.xlsx, .xls), Word (.doc, .docx)</p>
                <p>• Maximum file size: 100MB</p>
                <p>• Processing time: 30 seconds - 5 minutes depending on file size</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}