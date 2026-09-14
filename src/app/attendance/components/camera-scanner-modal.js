"use client";

import { Button } from "@heroui/react";
import { X } from "lucide-react";

export default function CameraScannerModal({ onClose }) {
  return (
    <div className="modal-shade" role="dialog" aria-modal="true" aria-label="Mobile QR scanner">
      <div className="camera-modal">
        <div className="modal-heading">
          <div>
            <span className="eyebrow">MOBILE SCANNER</span>
            <h2>Scan credential</h2>
          </div>
          <Button isIconOnly variant="outline" className="icon-button" onPress={onClose} aria-label="Close scanner">
            <X size={19} />
          </Button>
        </div>
        <div id="camera-reader" />
        <p>Point the camera at a participant QR code.</p>
      </div>
    </div>
  );
}
