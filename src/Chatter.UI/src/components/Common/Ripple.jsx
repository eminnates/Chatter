import React, { useState, useLayoutEffect } from 'react';

const Ripple = ({ color = 'rgba(184, 212, 168, 0.4)' }) => {
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
      className="absolute inset-0 z-0 overflow-hidden rounded-[inherit] pointer-events-none"
    >
      {ripples.map((ripple) => (
        <span
          key={ripple.id}
          className="absolute rounded-full animate-ripple pointer-events-none"
          style={{
            top: ripple.y,
            left: ripple.x,
            width: ripple.size,
            height: ripple.size,
            backgroundColor: color
          }}
        />
      ))}
    </div>
  );
};

export default Ripple;