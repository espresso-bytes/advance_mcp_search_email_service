
import React, { useState } from 'react';
import type { User } from '../types';
import { authService } from '../services/authService';
import { UserIcon, MailIcon, LockIcon, LogOutIcon, XIcon, EyeIcon, EyeOffIcon, SpinnerIcon, TrashIcon } from './Icons';
import { ConfirmationModal } from './ConfirmationModal';

interface ProfileModalProps {
    user: User;
    onClose: () => void;
    onUserUpdate: () => Promise<void>;
}

export const ProfileModal: React.FC<ProfileModalProps> = ({ user, onClose, onUserUpdate }) => {
    const [name, setName] = useState(user.name);
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [isLoggingOut, setIsLoggingOut] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);

    const handleSaveChanges = async () => {
        setMessage('');
        setError('');
        setIsSaving(true);
        try {
            await authService.updateUser({ name, password: newPassword });
            await onUserUpdate(); // Refresh user data in App state
            setMessage('Changes saved successfully!');
            setTimeout(() => {
                setMessage('');
                onClose();
            }, 1500);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save changes.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleLogout = async () => {
        setError('');
        setMessage('');
        setIsLoggingOut(true);
        try {
            await authService.signOut();
            // The onAuthStateChange listener in App.tsx will now handle redirecting the user
            // to the login page. Forcing a reload is no longer necessary.
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to log out.');
            setIsLoggingOut(false);
        }
        // The spinner will continue until the component unmounts upon successful logout.
    };

    const handleDeleteAccount = async () => {
        setIsDeleteModalOpen(false);
        setError('');
        setMessage('');
        setIsDeleting(true);
        try {
            await authService.deleteUserAccount();
             // The onAuthStateChange listener in App.tsx will automatically handle
             // the user being redirected upon successful deletion.
        } catch(err) {
            setError(err instanceof Error ? err.message : 'Failed to delete account.');
            setIsDeleting(false); // only stop spinner on error
        }
    };

    return (
        <>
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                <div className="bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl w-full max-w-md p-6 relative">
                    <button onClick={onClose} className="absolute top-4 right-4 text-zinc-500 hover:text-zinc-200">
                        <XIcon className="w-6 h-6"/>
                    </button>
                    <h2 className="text-2xl font-bold text-white mb-6">Profile Settings</h2>
                    
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-medium text-zinc-400 block mb-2">Name</label>
                            <div className="relative">
                                <UserIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 outline-none"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-zinc-400 block mb-2">Email</label>
                            <div className="relative">
                                <MailIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input type="email" value={user.email} disabled className="w-full pl-10 pr-4 py-2 bg-zinc-800/50 border border-zinc-700 rounded-md text-zinc-400 cursor-not-allowed"/>
                            </div>
                        </div>
                        <div>
                            <label className="text-sm font-medium text-zinc-400 block mb-2">New Password (optional)</label>
                            <div className="relative">
                                <LockIcon className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"/>
                                <input 
                                    type={showPassword ? "text" : "password"} 
                                    value={newPassword} 
                                    onChange={(e) => setNewPassword(e.target.value)} 
                                    placeholder="Leave blank to keep current"
                                    className="w-full pl-10 pr-10 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-white focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300">
                                    {showPassword ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
                                </button>
                            </div>
                        </div>
                    </div>

                    {message && <p className="text-center text-green-400 mt-4">{message}</p>}
                    {error && <p className="text-center text-red-500 mt-4">{error}</p>}

                    <div className="mt-8 space-y-3">
                        <button 
                            onClick={handleSaveChanges} 
                            disabled={isSaving || isLoggingOut || isDeleting}
                            className="w-full py-2.5 font-semibold text-zinc-900 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md hover:from-zinc-100 hover:to-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-200 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isSaving ? <SpinnerIcon className="w-5 h-5 mx-auto animate-spin" /> : 'Save Changes'}
                        </button>
                        <button 
                            onClick={handleLogout}
                            disabled={isLoggingOut || isSaving || isDeleting}
                            className="w-full py-2.5 flex items-center justify-center gap-2 font-semibold text-zinc-300 bg-zinc-800 border border-zinc-700 rounded-md hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isLoggingOut ? (
                                <SpinnerIcon className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <LogOutIcon className="w-5 h-5"/>
                                    Logout
                                </>
                            )}
                        </button>
                    </div>
                    <div className="mt-6 pt-6 border-t border-zinc-700">
                        <button 
                            onClick={() => setIsDeleteModalOpen(true)}
                            disabled={isLoggingOut || isSaving || isDeleting}
                            className="w-full py-2.5 flex items-center justify-center gap-2 font-semibold text-red-400 bg-red-900/20 border border-red-800/50 rounded-md hover:bg-red-900/40 transition-colors disabled:opacity-50 disabled:cursor-wait"
                        >
                            {isDeleting ? <SpinnerIcon className="w-5 h-5 animate-spin" /> : <><TrashIcon className="w-5 h-5" /> Delete Account</>}
                        </button>
                    </div>
                </div>
            </div>
            <ConfirmationModal
                isOpen={isDeleteModalOpen}
                onClose={() => setIsDeleteModalOpen(false)}
                onConfirm={handleDeleteAccount}
                title="Delete Account"
                message="Are you sure you want to permanently delete your account? All of your data, including conversations, will be lost. This action cannot be undone."
            />
        </>
    );
};
