import React from 'react'
import Link from 'next/link';
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';

export default function AuthenticationFooter() {
    const rightDrawerType = rightDrawerContent((state) => state.rightDrawerType);
    const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);

    const handlePageChange = (link) => {
        setRightDrawerType(link);
    }

  return (
    <div className={`w-full h-auto ${rightDrawerType === 'Reset Password'? 'hidden' : 'block'}`}>
        <div className='w-[100%] px-[15%] text-center'>
            <p className='text-gray-500 text-[12px]'>By continuing, you agree to our <span className='font-medium hover:text-[#00233d]'><Link href='/terms-of-service'>Terms of Service</Link></span> and confirm that you have read our <span className='font-medium hover:text-[#00233d]'><Link href='/privacy-policy'>Privacy Policy</Link></span>.</p>
            </div>
        <div className='w-full h-[70px] mt-[30px] bg-[#fafafa] flex justify-center items-center'>
            <p>{rightDrawerType === 'Log In'? "Don't have an account?" : 'Already have an account?'}</p>
            <p className='ml-[5px] font-bold cursor-pointer hover:scale-105 text-[#00233d]' onClick={() => handlePageChange(rightDrawerType === 'Log In'? "Sign Up" : 'Log In')}>{rightDrawerType === 'Log In'? "Sign Up" : 'Log In'}</p>
        </div>
    </div>
  )
}