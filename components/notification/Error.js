'use client';
import React, { useEffect, useState } from 'react';
import useNotification from '../../stores/notification/useNotification';

export default function Error() {
  const notificationContent = useNotification((state) => state.notificationContent);
  const toggleNotification = useNotification((state) => state.toggleNotification);
  const setNotificationType = useNotification((state) => state.setNotificationType);
  const setNotificationContent = useNotification((state) => state.setNotificationContent);
  const [hasRun, setHasRun] = useState(false);

  useEffect(() => {
    if (hasRun === false) {
      setHasRun(true);
      const timeoutId = setTimeout(() => {
        toggleNotification();
        setNotificationType('none');
        setNotificationContent(null);
      }, 5000);

      return () => {
        clearTimeout(timeoutId);
      };
    }
  }, []);

  return (
    <div className="fixed bottom-[5%] left-[2.5%] w-[350px] h-auto p-[14px] text-white rounded-sm shadow-md bg-red-500">
      <p>{notificationContent}</p>
    </div>
  );
}