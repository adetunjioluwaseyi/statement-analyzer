"use client"

import { useCallback, useState } from "react"
import { useDropzone } from "react-dropzone"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Upload, FileText, AlertCircle } from "lucide-react"
import type { CSVData } from "@/app/page"
import Papa from "papaparse"

interface FileUploadProps {
  onFileUpload: (data: CSVData) => void
  fileNumber: 1 | 2
}

export function FileUpload({ onFileUpload, fileNumber }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const parseCSV = useCallback(
    (file: File) => {
      setIsLoading(true)
      setError(null)

      Papa.parse(file, {
        header: false,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            if (results.errors.length > 0) {
              setError(`CSV parsing error: ${results.errors[0].message}`)
              setIsLoading(false)
              return
            }

            const data = results.data as string[][]
            if (data.length === 0) {
              setError("File appears to be empty")
              setIsLoading(false)
              return
            }

            const headers = data[0]
            const rows = data.slice(1)

            onFileUpload({
              headers,
              rows,
              fileName: file.name,
            })

            setIsLoading(false)
          } catch (err) {
            setError("Failed to process file")
            setIsLoading(false)
          }
        },
        error: (error) => {
          setError(`File reading error: ${error.message}`)
          setIsLoading(false)
        },
      })
    },
    [onFileUpload],
  )

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0]
      if (file) {
        parseCSV(file)
      }
    },
    [parseCSV],
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
    },
    maxFiles: 1,
  })

  return (
    <div className="space-y-4">
      <Card className="border-0 bg-transparent shadow-none transition-colors">
        <CardContent className="p-0">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-7 text-center cursor-pointer transition-all
              ${isDragActive ? "border-primary bg-secondary" : "border-border/80 bg-[#fbfcfb] hover:border-primary/50 hover:bg-white"}
              ${isLoading ? "pointer-events-none opacity-50" : ""}
            `}
          >
            <input {...getInputProps()} />
            <div className="space-y-4">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-[#e5f3d4]">
                {isLoading ? (
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                ) : (
                  <Upload className="h-6 w-6 text-primary" />
                )}
              </div>
              <div>
                <p className="text-base font-semibold">
                  {isDragActive ? "Drop your file here" : "Drag & drop your CSV file"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">Drop a CSV file, or browse your device</p>
              </div>
              <Button variant="outline" disabled={isLoading}>
                <FileText className="h-4 w-4 mr-2" />
                {isLoading ? "Processing..." : "Choose File"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{error}</p>
        </div>
      )}
    </div>
  )
}
