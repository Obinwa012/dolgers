'use client'
import React, { useState } from 'react'
import { PiShieldCheckFill  } from "react-icons/pi";
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';
import { sanitizeEmail } from '@/functions/sanitizeEmail';
import { login } from '@/functions/login';
import { signup } from '@/functions/signup';
import { auth } from '@/libs/firebase/firebase';
import useCustomer from '@/stores/customer/useCustomer';
import useRightDrawer from '@/stores/rightDrawer/useRightDrawer';
import { validatePassword } from '@/functions/validatePassword';
import { sendPasswordResetEmail } from 'firebase/auth';
import useNotification from '@/stores/notification/useNotification';

export default function AuthenticationForms() {
    const [password, setPassword] = useState('');
    const [secondPassword, setSecondPassword] = useState('');
    const [email, setEmail] = useState('');
    const [success, setSuccessMessage] = useState('');
    const [error, setErrorMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const toggleRightDrawer = useRightDrawer((state) => state.toggleRightDrawer);
    const rightDrawerType = rightDrawerContent((state) => state.rightDrawerType);
    const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);
    const setCustomerData = useCustomer((state) => state.setCustomerData);
    const setCustomerDataInLocalStorage = useCustomer((state) => state.setCustomerDataInLocalStorage);
    const toggleNotification = useNotification((state) => state.toggleNotification);
    const setNotificationType = useNotification((state) => state.setNotificationType);
    const setNotificationContent = useNotification((state) => state.setNotificationContent);

    const handleClosePage = () => {
      setEmail('');
      setPassword('');
      setSecondPassword('');
      setSuccessMessage('');
      setErrorMessage('');
      setRightDrawerType('None');
      toggleRightDrawer();
    }

    const handleAuthentication = async (e) => {
        e.preventDefault();
        setLoading(true);
        setSuccessMessage('');
        setErrorMessage('');

        if(rightDrawerType === "Log In"){
          try {
              const sanitizedEmail = await sanitizeEmail(email);
              const safePassword = password.toString();
              const loggedIn = await login(sanitizedEmail, safePassword);

              if(loggedIn !== null && typeof loggedIn === 'object'){
                setCustomerDataInLocalStorage(loggedIn[0]);
                setCustomerData(loggedIn[1]);
                toggleNotification();
                setNotificationType('success');
                setNotificationContent('Welcome back, ' + loggedIn[1].name + '! You are now logged in.');
                handleClosePage();
              } else if(loggedIn === 'auth/invalid-credential' || loggedIn === 'auth/user-not-found'){
                setErrorMessage('Incorrect username or password. Please try again.');
              } else {
                setErrorMessage('Oops! Something went wrong. Please try again.');
              }
          } catch (error) {
            setErrorMessage('Oops! Something went wrong. Please try again.');
          }
        }
        else if(rightDrawerType === "Sign Up"){
          try{
            const sanitizedEmail = await sanitizeEmail(email);
            const safePassword = password.toString();
            const validatedPassword = await validatePassword(safePassword, secondPassword);
  
            if(validatedPassword === 'true'){
              const signedup = await signup(sanitizedEmail, safePassword);
              
              if(signedup !== null && typeof signedup === 'object'){
                setCustomerDataInLocalStorage(signedup[0]);
                setCustomerData(signedup[1]);
                toggleNotification();
                setNotificationType('success');
                setNotificationContent("Congratulations! You're now part of the [Your Community] community.");
                handleClosePage();
              } else if(signedup === 'auth/email-already-in-use'){
                setErrorMessage('Email already in use. Please try again.');
              } else if(signedup === 'auth/invalid-email'){
                setErrorMessage('Invalid email. Please try again.');
              }else{
                setErrorMessage('Oops! Something went wrong. Please try again.');
              }
            }else{
              setErrorMessage(validatedPassword);
            }
          }catch(error){
            setErrorMessage('Oops! Something went wrong. Please try again.'); 
          } 
        }
        else{
          try{
            await sendPasswordResetEmail(auth, email);

            setEmail('');
            setSuccessMessage('Password reset email sent! Please check your inbox');
          }catch(e){
            setErrorMessage('Oops! Something went wrong. Please try again.')
          } 
        }
        setLoading(false);  
    }

  return (
    <div className='flex-grow w-full mt-[45px] flex flex-col justify-start items-center'>
      <form onSubmit={handleAuthentication} className={`w-[350px] flex flex-col justify-center items-center`}>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          required
          className='w-full px-[5%] py-[2.5%] border-[0.5px] border-none bg-[#f5f5f5] focus:outline-none active:outline-none'
        />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          required={rightDrawerType !== "Reset Password"? true : false}
          className={`w-full px-[5%] py-[2.5%] border-[0.5px] mt-[10px] border-none bg-[#f5f5f5] focus:outline-none active:outline-none ${rightDrawerType === "Reset Password"? 'hidden' : 'block'}`}
        />
        <input
          type="password"
          value={secondPassword}
          onChange={(e) => setSecondPassword(e.target.value)}
          placeholder="Confirm Password"
          required={rightDrawerType === "Sign Up"? true : false}
          className={`w-full px-[5%] py-[2.5%] border-[0.5px] border-none bg-[#f5f5f5] focus:outline-none active:outline-none mt-[10px] ${rightDrawerType !== "Sign Up"? 'hidden' : 'block'}`}
        />
        <button className={`w-full px-[5%] py-[3%] bg-[#00233d] ${email !== ''? 'opacity-100' : 'opacity-50'} border-[#00233d] cursor-pointer text-white mt-[10px]`}>{loading? <span className="loading loading-dots loading-sm"></span> : rightDrawerType}</button>
        <div className={`w-full px-[5%] py-[5%] text-center cursor-pointer hover:text-[#00233d] underline text-gray-500 ${rightDrawerType === "Log In"? 'block' : 'hidden'}`} onClick={() => setRightDrawerType('Reset Password')}>Reset your password</div>
        <div className={`w-full px-[5%] py-[5%] text-center cursor-pointer hover:text-[#00233d] underline text-gray-500 ${rightDrawerType === "Reset Password"? 'block' : 'hidden'}`} onClick={() => setRightDrawerType('Log In')}>Return to Log In</div>
        <div className={`flex justify-center items-center w-full px-[5%] text-[12px] mt-[5%] ${rightDrawerType === "Sign Up"? 'block' : 'hidden'}`}>
          <PiShieldCheckFill className='mr-[5px] text-green-500'/>
          <p>Your information is protected</p>
        </div>
        {error && <p className='w-[100%] px-[10%] text-center text-[12px] mt-[30px] text-red-500'>{error}</p>}
        {success && <p className='w-[100%] px-[10%] text-center text-[12px] mt-[30px] text-green-500'>{success}</p>}
      </form>
    </div>
  )
}
