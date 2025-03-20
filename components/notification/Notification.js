'use client';
import Success from '@/components/notification/Success';
import Error from '@/components/notification/Error';
import useNotification from '@/stores/notification/useNotification';
import React from 'react';


export default function Notification() {
    const isNotificationOpen = useNotification((state) => state.isNotificationOpen);
    const notificationType = useNotification((state) => state.notificationType);
    const notificationContent = useNotification((state) => state.notificationContent);


  const closeRightDrawer = () => {
    toggleRightDrawer();
    setRightDrawerType('none');
  };

  const NotificationContent = ({ type }) => {
    const renderContent = () => {
      switch (type) {
        case 'none':
          return <></>
        case 'success':
          return <Success />
        case 'error':
          return <Error />
        default:
          return <></>;
      }
    };

    return (
      <div className={`h-dvh bg-black relative`}>
        {renderContent()}
      </div>
    );
  };

  return (
    <main className={`h-screen absolute top-0 right-0 z-30 bg-transparent`}>

      {/* Black overlay background */}
      <section className="h-full absolute top-0 right-0 bg-black opacity-0 cursor-pointer"></section>

      {/* Right Drawer Content*/}
      <NotificationContent type={notificationType} />
    
    </main>
  );
}