import { useEffect, useState } from 'react';

export const motion = {
  fast: 160,
  standard: 360,
  editorial: 720,
  stagger: 70,
  ease: 'cubic-bezier(.22,1,.36,1)',
};

export function useReducedMotion() {
  const [reduced, setReduced] = useState(() => (
    typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ));
  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const update = () => setReduced(media.matches);
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);
  return reduced;
}

export function useMotionSystem(path, onChapter) {
  const reduced = useReducedMotion();

  useEffect(() => {
    document.documentElement.classList.toggle('reduced-motion', reduced);
    const countFrames = new Set();
    const reveal = (node) => {
      node.classList.add('is-visible');
      if (node.hasAttribute('data-count')) animateCount(node, reduced, countFrames);
    };
    const observer = !reduced && 'IntersectionObserver' in window
      ? new IntersectionObserver((entries) => entries.forEach((entry) => {
        if (entry.isIntersecting) {
          reveal(entry.target);
          observer.unobserve(entry.target);
        }
      }), { rootMargin: '0px 0px -5%', threshold: 0.04 })
      : null;

    const register = (root = document) => {
      if (root.matches?.('[data-reveal]:not(.is-motion-registered), [data-count]:not(.is-motion-registered)')) {
        root.classList.add('is-motion-registered');
        if (observer) observer.observe(root); else reveal(root);
      }
      root.querySelectorAll?.('[data-reveal]:not(.is-motion-registered), [data-count]:not(.is-motion-registered)').forEach((node) => {
        node.classList.add('is-motion-registered');
        if (observer) observer.observe(node); else {
          reveal(node);
        }
      });
    };
    register();
    let revealFrame = 0;
    const revealInView = () => {
      revealFrame = 0;
      document.querySelectorAll('[data-reveal].is-motion-registered:not(.is-visible), [data-count].is-motion-registered:not(.is-visible)').forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (rect.top < window.innerHeight * .95 && rect.bottom > 0) {
          reveal(node);
          observer?.unobserve(node);
        }
      });
    };
    const scheduleReveal = () => { if (!revealFrame) revealFrame = requestAnimationFrame(revealInView); };
    revealInView();
    window.addEventListener('scroll', scheduleReveal, { passive: true });
    window.addEventListener('resize', scheduleReveal);
    const mutations = new MutationObserver((records) => records.forEach((record) => record.addedNodes.forEach((node) => {
      if (node.nodeType === 1) register(node);
    })));
    mutations.observe(document.getElementById('main-content'), { childList: true, subtree: true });
    return () => {
      observer?.disconnect(); mutations.disconnect();
      window.removeEventListener('scroll', scheduleReveal); window.removeEventListener('resize', scheduleReveal);
      if (revealFrame) cancelAnimationFrame(revealFrame);
      countFrames.forEach((countFrame) => cancelAnimationFrame(countFrame));
      countFrames.clear();
    };
  }, [path, reduced]);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      document.documentElement.style.setProperty('--page-progress', max > 0 ? String(window.scrollY / max) : '0');
      const chapters = [...document.querySelectorAll('[data-chapter]')];
      const active = chapters.reduce((current, chapter) => (
        chapter.getBoundingClientRect().top <= window.innerHeight * .48 ? chapter : current
      ), chapters[0]);
      onChapter?.(active?.dataset.chapter || 'Opening whistle');
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update(); window.addEventListener('scroll', schedule, { passive: true }); window.addEventListener('resize', schedule);
    return () => { window.removeEventListener('scroll', schedule); window.removeEventListener('resize', schedule); if (frame) cancelAnimationFrame(frame); };
  }, [path, onChapter]);

  useEffect(() => {
    if (reduced || !window.matchMedia?.('(pointer:fine)').matches) return undefined;
    const move = (event) => {
      const target = event.target.closest?.('[data-magnetic], .button-primary');
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty('--mx', `${(event.clientX - rect.left - rect.width / 2) * .09}px`);
      target.style.setProperty('--my', `${(event.clientY - rect.top - rect.height / 2) * .12}px`);
    };
    const clear = (event) => {
      const target = event.target.closest?.('[data-magnetic], .button-primary');
      target?.style.setProperty('--mx', '0px'); target?.style.setProperty('--my', '0px');
    };
    document.addEventListener('pointermove', move); document.addEventListener('pointerout', clear);
    return () => { document.removeEventListener('pointermove', move); document.removeEventListener('pointerout', clear); };
  }, [reduced]);

  return reduced;
}

function animateCount(node, immediate = false, frames = new Set()) {
  const target = Number(node.dataset.count);
  if (!Number.isFinite(target) || node.dataset.counted) return;
  node.dataset.counted = 'true';
  const decimals = Number(node.dataset.decimals || 0);
  const suffix = node.dataset.suffix || '';
  const finish = () => { node.textContent = `${target.toFixed(decimals)}${suffix}`; };
  if (immediate || document.visibilityState === 'hidden') { finish(); return; }
  const started = performance.now();
  let frame = 0;
  const schedule = () => {
    frame = requestAnimationFrame(tick);
    frames.add(frame);
  };
  const tick = (now) => {
    frames.delete(frame);
    const progress = Math.min((now - started) / motion.editorial, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    node.textContent = `${(target * eased).toFixed(decimals)}${suffix}`;
    if (document.visibilityState === 'hidden') finish();
    else if (progress < 1) schedule();
  };
  schedule();
}
