'use client';
import React from 'react';
import { PiXBold } from 'react-icons/pi';
import Authentication from './authentication/Authentication';
import useRightDrawer from '@/stores/rightDrawer/useRightDrawer';
import rightDrawerContent from '@/stores/rightDrawer/rightDrawerContent';


export default function RightDrawer() {
  const isRightDrawerOpen = useRightDrawer((state) => state.isRightDrawerOpen);
  const toggleRightDrawer = useRightDrawer((state) => state.toggleRightDrawer);
  const rightDrawerType = rightDrawerContent((state) => state.rightDrawerType);
  const setRightDrawerType = rightDrawerContent((state) => state.setRightDrawerType);

  const closeRightDrawer = () => {
    toggleRightDrawer();
    setRightDrawerType('none');
  };

  const RightDrawerContent = ({ type }) => {
    const renderContent = () => {
      switch (type) {
        case 'none':
          return <></>;
        default:
          return <Authentication />;
      }
    };

    return (
      <div className={`absolute top-0 right-0 w-full h-full bg-white overflow-hidden scrollbar-hide transform ${type ? 'translate-x-0' : 'translate-x-[100%]'} transition-transform duration-300 ease-in-out`}>
        {renderContent()}
      </div>
    );
  };

  return (
    <main className={`h-screen absolute top-0 right-0 z-30 w-full bg-transparent ${isRightDrawerOpen ? 'block' : 'hidden'}`}>

      {/* Black overlay background */}
      <section className="w-full h-full absolute top-0 right-0 bg-black opacity-40 cursor-pointer" onClick={closeRightDrawer}></section>

      {/* Drawer itself */}
      <section className={`w-full sm:w-[450px] h-full absolute top-0 right-0 bg-white opacity-100 transform transition-transform duration-500 ease-in-out ${isRightDrawerOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Right Drawer Content*/}
        <RightDrawerContent type={rightDrawerType} />
      </section>

      {/* Drawer close button */}
      <div className="text-[21px] absolute top-0 right-[450px] w-[40px] h-[40px] hidden sm:flex cursor-pointer hover:scale-105 text-white justify-center items-center" onClick={closeRightDrawer}>
        <PiXBold />
      </div>

      {/* Mobile Drawer close button */}
      <div className="text-[21px] absolute top-0 right-[90%] w-[40px] h-[40px] sm:hidden cursor-pointer hover:scale-105 text-[#00233d] flex justify-center items-center" onClick={closeRightDrawer}>
        <PiXBold />
      </div>

    </main>
  );
}