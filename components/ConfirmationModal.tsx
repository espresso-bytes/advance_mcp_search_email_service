import React from 'react';
import { XIcon, AlertTriangleIcon } from './Icons';

interface ConfirmationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    title: string;
    message: string;
}

export const ConfirmationModal: React.FC<ConfirmationModalProps> = ({ isOpen, onClose, onConfirm, title, message }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-md p-6 relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200">
                    <XIcon className="w-6 h-6"/>
                </button>
                <div className="flex items-start gap-4">
                    <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-900/50 sm:mx-0 sm:h-10 sm:w-10">
                        <AlertTriangleIcon className="h-6 w-6 text-red-400" aria-hidden="true" />
                    </div>
                    <div className="mt-0 text-left flex-1">
                        <h3 className="text-lg font-bold leading-6 text-white" id="modal-title">
                            {title}
                        </h3>
                        <div className="mt-2">
                            <p className="text-sm text-zinc-400">
                                {message}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex flex-col sm:flex-row-reverse gap-3">
                    <button
                        type="button"
                        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
                        onClick={onConfirm}
                    >
                        Delete
                    </button>
                    <button
                        type="button"
                        className="w-full sm:w-auto px-4 py-2 text-sm font-semibold text-zinc-200 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
                        onClick={onClose}
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
};
