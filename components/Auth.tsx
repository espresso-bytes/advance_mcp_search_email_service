
import React, { useState } from 'react';
import { authService } from '../services/authService';
import { UserIcon, MailIcon, LockIcon, EyeIcon, EyeOffIcon, CheckCircleIcon, SpinnerIcon } from './Icons';

const AuthLayout: React.FC<{ title: string; subtitle: string; children: React.ReactNode }> = ({ title, subtitle, children }) => (
    <div className="flex items-center justify-center min-h-screen bg-zinc-900 p-4 bg-grid-zinc-700/[0.2]">
        <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900/80 backdrop-blur-sm rounded-2xl shadow-2xl shadow-black/30 border border-zinc-700/50">
            <div className="text-center">
                <h1 className="text-3xl font-bold text-zinc-100">{title}</h1>
                <p className="mt-2 text-zinc-400">{subtitle}</p>
            </div>
            {children}
        </div>
    </div>
);

const InputField: React.FC<{ id: string; type: string; label: string; value: string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; icon: React.ReactNode; toggleVisibility?: () => void; isPasswordVisible?: boolean; }> = 
({ id, type, label, value, onChange, icon, toggleVisibility, isPasswordVisible }) => (
    <div className="relative">
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-zinc-500">
            {icon}
        </div>
        <input
            id={id}
            name={id}
            type={type}
            required
            className="w-full pl-10 pr-10 py-3 bg-zinc-800/50 border border-zinc-700 text-zinc-200 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition duration-200"
            placeholder={label}
            value={value}
            onChange={onChange}
        />
        {toggleVisibility && (
             <button type="button" onClick={toggleVisibility} className="absolute inset-y-0 right-0 flex items-center pr-3 text-zinc-500 hover:text-zinc-300">
                {isPasswordVisible ? <EyeOffIcon className="h-5 w-5"/> : <EyeIcon className="h-5 w-5"/>}
            </button>
        )}
    </div>
);

const Login: React.FC<{ onSwitchMode: () => void }> = ({ onSwitchMode }) => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        try {
            await authService.signIn(email, password);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        }
    };

    return (
        <AuthLayout title="Welcome Back" subtitle="Sign in to continue your search">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <InputField id="email" type="email" label="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<MailIcon className="w-5 h-5"/>} />
                <InputField id="password" type={showPassword ? 'text' : 'password'} label="Enter your password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<LockIcon className="w-5 h-5"/>} toggleVisibility={() => setShowPassword(!showPassword)} isPasswordVisible={showPassword}/>
                <button type="submit" className="w-full py-3 font-semibold text-zinc-900 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md hover:from-zinc-100 hover:to-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-200 transition-transform transform hover:scale-105">
                    Sign In
                </button>
            </form>
            <p className="text-center text-sm text-zinc-400">
                Don't have an account?{' '}
                <button onClick={onSwitchMode} className="font-medium text-blue-400 hover:underline">
                    Sign Up
                </button>
            </p>
        </AuthLayout>
    );
};

const SignUp: React.FC<{ onSwitchMode: () => void }> = ({ onSwitchMode }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            setError("Passwords don't match.");
            return;
        }
        setError('');
        setIsLoading(true);
        try {
            await authService.signUp(name, email, password);
            setIsSuccess(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isSuccess) {
        return (
            <AuthLayout title="Check Your Inbox!" subtitle={`We've sent a confirmation link to ${email}`}>
                <div className="text-center space-y-6">
                    <CheckCircleIcon className="w-16 h-16 text-green-400 mx-auto" />
                    <p className="text-zinc-300 text-base">
                        Please click the link in the email to activate your account. If you don't see it, please check your spam folder.
                    </p>
                    <button 
                        onClick={onSwitchMode} 
                        className="w-full py-3 font-semibold text-zinc-900 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md hover:from-zinc-100 hover:to-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-200 transition-transform transform hover:scale-105"
                    >
                        Back to Sign In
                    </button>
                </div>
            </AuthLayout>
        );
    }

    return (
        <AuthLayout title="Create Account" subtitle="Join the future of search">
            <form className="space-y-6" onSubmit={handleSubmit}>
                {error && <p className="text-red-500 text-center">{error}</p>}
                <InputField id="name" type="text" label="Enter your name" value={name} onChange={(e) => setName(e.target.value)} icon={<UserIcon className="w-5 h-5"/>} />
                <InputField id="email" type="email" label="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} icon={<MailIcon className="w-5 h-5"/>} />
                <InputField id="password" type={showPassword ? 'text' : 'password'} label="Create a password" value={password} onChange={(e) => setPassword(e.target.value)} icon={<LockIcon className="w-5 h-5"/>} toggleVisibility={() => setShowPassword(!showPassword)} isPasswordVisible={showPassword}/>
                <InputField id="confirmPassword" type={showConfirmPassword ? 'text' : 'password'} label="Confirm your password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} icon={<LockIcon className="w-5 h-5"/>} toggleVisibility={() => setShowConfirmPassword(!showConfirmPassword)} isPasswordVisible={showConfirmPassword}/>
                <button type="submit" disabled={isLoading} className="w-full py-3 font-semibold text-zinc-900 bg-gradient-to-b from-zinc-200 to-zinc-400 rounded-md hover:from-zinc-100 hover:to-zinc-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-900 focus:ring-zinc-200 transition-transform transform hover:scale-105 disabled:opacity-50 disabled:cursor-wait">
                    {isLoading ? <SpinnerIcon className="w-5 h-5 mx-auto animate-spin" /> : 'Sign Up'}
                </button>
            </form>
            <p className="text-center text-sm text-zinc-400">
                Already have an account?{' '}
                <button onClick={onSwitchMode} className="font-medium text-blue-400 hover:underline">
                    Sign In
                </button>
            </p>
        </AuthLayout>
    );
};

export const AuthComponent: React.FC = () => {
    const [isLogin, setIsLogin] = useState(true);
    return isLogin ? <Login onSwitchMode={() => setIsLogin(false)} /> : <SignUp onSwitchMode={() => setIsLogin(true)} />;
};
