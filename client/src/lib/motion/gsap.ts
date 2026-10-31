// GSAP for the pinned / scrubbed chapters. Import this only from lazily loaded modules, so GSAP
// stays out of the first-load bundle.
import { useGSAP } from '@gsap/react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };
