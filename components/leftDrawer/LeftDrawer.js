'use client'
import React from 'react'
import { PiXBold } from "react-icons/pi";
import useLeftDrawer from '@/stores/leftDrawer/useLeftDrawer'
import leftDrawerContent from '@/stores/leftDrawer/leftDrawerContent';
import MobileMenu from './mobileMenu/MobileMenu';


export default function LeftDrawer() {
  const isLeftDrawerOpen = useLeftDrawer((state) => state.isLeftDrawerOpen);
  const toggleLeftDrawer = useLeftDrawer((state) => state.toggleLeftDrawer);
  const leftDrawerType = leftDrawerContent((state) => state.leftDrawerType);
  const setLeftDrawerType = leftDrawerContent((state) => state.setLeftDrawerType)

  const closeLeftDrawer = () => {
    toggleLeftDrawer();
    setLeftDrawerType('none');
  }
  
  const LeftDrawerContent = ({ type }) => {

    const renderContent = () => {
      switch (type) {
        case 'none':
          return <></>;
        case 'mobileMenu':
          return <MobileMenu />;
        default:
          return <></>;
      }
    };
  
    return (
      <div className={`absolute top-0 left-0 w-full h-full bg-white overflow-hidden scrollbar-hide transform ${type ? 'translate-x-0' : '-translate-x-[100%]'} transition-transform duration-300 ease-in-out`}>
        {renderContent()}
      </div>
    );
  };

  
  return (
    <main className={`h-screen absolute top-0 left-0 z-30 w-full bg-transparent ${isLeftDrawerOpen? 'block lg:hidden' : 'hidden'}`}>

      {/* Black overlay background */}
      <section className="w-full h-full absolute top-0 left-0 bg-black opacity-40 cursor-pointer" onClick={closeLeftDrawer}></section>

      {/* Drawer itself */}
      <section className={`w-[320px] h-full absolute top-0 left-0 bg-white opacity-100 transform transition-transform duration-500 ease-in-out ${isLeftDrawerOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        
        {/* Left Drawer Content*/}
        <LeftDrawerContent type={leftDrawerType} />
        
      </section>

      {/* Drawer close button */}
      <div className='text-[21px] absolute top-0 left-[320px] w-[40px] h-[40px] cursor-pointer hover:scale-105 text-white flex justify-center items-center' onClick={closeLeftDrawer}>
        <PiXBold />
      </div>

    </main>

  )
}