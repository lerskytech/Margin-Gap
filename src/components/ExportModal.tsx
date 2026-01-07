// Simple modal for choosing export format
import { Card, CardHeader, CardTitle, CardContent } from '@/ui/Card'
import { Button } from '@/ui/Button'

interface ExportModalProps {
  onExportJSON: () => void
  onExportCSV: () => void
  onClose: () => void
}

export function ExportModal({ onExportJSON, onExportCSV, onClose }: ExportModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <Card className="w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button 
            variant="primary" 
            className="w-full"
            onClick={() => {
              onExportJSON()
              onClose()
            }}
          >
            Export as JSON
          </Button>
          <Button 
            variant="outline" 
            className="w-full"
            onClick={() => {
              onExportCSV()
              onClose()
            }}
          >
            Export as CSV
          </Button>
          <Button 
            variant="ghost" 
            className="w-full"
            onClick={onClose}
          >
            Cancel
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

