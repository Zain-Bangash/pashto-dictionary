import { useRef } from 'react';

// Mouse-driven 3D tilt with a directional gold shadow (DESIGN-SYSTEM "3D Tilt"); styles are set on the element directly
export default function useTilt(degrees = 12) {
  const ref = useRef(null);

  const onMouseMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const { left, top, width, height } = el.getBoundingClientRect();
    const x = (e.clientX - left) / width - 0.5;
    const y = (e.clientY - top) / height - 0.5;
    el.style.transition = 'transform 0.08s ease, box-shadow 0.08s ease';
    el.style.transform = `perspective(700px) rotateX(${-y * degrees}deg) rotateY(${x * degrees}deg) scale(1.03)`;
    el.style.boxShadow = `${x * -12}px ${y * -12}px 28px rgba(232,197,71,0.1), inset 0 1px 0 rgba(255,255,255,0.08)`;
  };

  const onMouseLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.transition = 'transform 0.55s cubic-bezier(0.22,1,0.36,1), box-shadow 0.55s ease';
    el.style.transform = '';
    el.style.boxShadow = '';
  };

  return { ref, onMouseMove, onMouseLeave };
}
