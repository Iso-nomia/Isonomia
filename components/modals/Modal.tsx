"use client";

import React from "react";
import { Dialog } from "../ui/dialog";
import { useModalStore } from "@/lib/stores/modalStore";

const Modal = () => {
  const { isModalOpen, modalContent, closeModal } = useModalStore();

  return (
    <div className="absolute">
      <Dialog open={isModalOpen} onOpenChange={closeModal}>
        <div>{modalContent}</div>
      </Dialog>
    </div>
  );
};

export default Modal;
