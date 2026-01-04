import React, { useState, useLayoutEffect } from 'react';
import './Ripple.css'; // <--- YENİ EKLENEN SATIR

const Ripple = ({ color }) => {
  // ... kodun geri kalanı aynı kalsın ...
  const [ripples, setRipples] = useState([]);

  useLayoutEffect(() => {
    let bounce = null;
    if (ripples.length > 0) {
      clearTimeout(bounce);
      bounce = setTimeout(() => {
        setRipples([]);
      }, 700);
    }
    return () => clearTimeout(bounce);
  }, [ripples.length]);

  const addRipple = (event) => {
    const container = event.currentTarget.getBoundingClientRect();
    const size = container.width > container.height ? container.width : container.height;
    const x = event.clientX - container.left - size / 2;
    const y = event.clientY - container.top - size / 2;

    const newRipple = { x, y, size, id: Date.now() };
    setRipples((prev) => [...prev, newRipple]);
  };

  return (
    <div 
      onMouseDown={addRipple} 
      onTouchStart={addRipple}
      style={{
        position: 'absolute',
        top: 0, right: 0, bottom: 0, left: 0,
        zIndex: 0,
        // overflow: 'hidden' -> Artık CSS dosyasında .ripple-container hallediyor ama burada da kalabilir
        borderRadius: 'inherit'
      }}
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="ripple"
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color // Eğer prop olarak renk gelirse CSS'i ezer
          }}
        />
      ))}
    </div>
  );
};

export default Ripple;