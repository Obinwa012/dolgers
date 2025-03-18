import React from 'react'
import AuthenticationHeader from './AuthenticationHeader';
import AuthenticationFooter from './AuthenticationFooter';
import AuthenticationForms from './AuthenticationForms';

export default function Authentication() {
  return (
    <div className='w-full h-full bg-white flex flex-col justify-between items-center'>
        
        {/* Header */}
        <AuthenticationHeader />

        {/* Forms */}
        <AuthenticationForms />

        {/* Footer */}
        <AuthenticationFooter />
    </div>
  )
}
