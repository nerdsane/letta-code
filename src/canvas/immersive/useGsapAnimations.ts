/**
 * useGsapAnimations - GSAP and ScrollTrigger integration hooks
 *
 * Provides React-friendly hooks for scroll-driven animations,
 * parallax effects, and view transitions.
 */

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useCallback, useEffect, useRef } from "react";

// Register GSAP plugins
if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

// ============================================================================
// Types
// ============================================================================

export interface ScrollAnimationConfig {
  /** Trigger element selector or ref */
  trigger: string | HTMLElement;
  /** Start position (default: "top bottom") */
  start?: string;
  /** End position (default: "bottom top") */
  end?: string;
  /** Scrub animation to scroll (true, false, or smooth time) */
  scrub?: boolean | number;
  /** Pin the trigger element */
  pin?: boolean;
  /** Show markers for debugging */
  markers?: boolean;
  /** Animation to play */
  animation?: gsap.core.Tween | gsap.core.Timeline;
  /** Callback when entering */
  onEnter?: () => void;
  /** Callback when leaving */
  onLeave?: () => void;
  /** Callback when entering from bottom */
  onEnterBack?: () => void;
  /** Callback when leaving to bottom */
  onLeaveBack?: () => void;
}

export interface ParallaxConfig {
  /** Target element */
  target: string | HTMLElement;
  /** Parallax speed (-1 to 1, 0 = no parallax) */
  speed?: number;
  /** Direction of parallax */
  direction?: "vertical" | "horizontal";
}

// ============================================================================
// useScrollAnimation - Create scroll-triggered animation
// ============================================================================

export function useScrollAnimation(
  config: ScrollAnimationConfig,
  deps: React.DependencyList = [],
) {
  const scrollTriggerRef = useRef<ScrollTrigger | null>(null);

  useEffect(() => {
    // Cleanup previous
    scrollTriggerRef.current?.kill();

    const st = ScrollTrigger.create({
      trigger: config.trigger,
      start: config.start ?? "top bottom",
      end: config.end ?? "bottom top",
      scrub: config.scrub ?? false,
      pin: config.pin ?? false,
      markers: config.markers ?? false,
      animation: config.animation,
      onEnter: config.onEnter,
      onLeave: config.onLeave,
      onEnterBack: config.onEnterBack,
      onLeaveBack: config.onLeaveBack,
    });

    scrollTriggerRef.current = st;

    return () => {
      st.kill();
    };
  }, deps);

  return scrollTriggerRef;
}

// ============================================================================
// useParallax - Create parallax effect
// ============================================================================

export function useParallax(
  config: ParallaxConfig,
  deps: React.DependencyList = [],
) {
  const tweenRef = useRef<gsap.core.Tween | null>(null);

  useEffect(() => {
    tweenRef.current?.kill();

    const speed = config.speed ?? 0.5;
    const direction = config.direction ?? "vertical";

    const tween = gsap.to(config.target, {
      [direction === "vertical" ? "y" : "x"]: () =>
        speed * window.innerHeight * 0.5,
      ease: "none",
      scrollTrigger: {
        trigger: config.target,
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    });

    tweenRef.current = tween;

    return () => {
      tween.kill();
    };
  }, deps);

  return tweenRef;
}

// ============================================================================
// useFadeIn - Fade in elements as they enter viewport
// ============================================================================

export function useFadeIn(
  selector: string,
  options: {
    stagger?: number;
    duration?: number;
    y?: number;
    delay?: number;
  } = {},
) {
  useEffect(() => {
    const elements = document.querySelectorAll(selector);
    if (elements.length === 0) return;

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: elements[0],
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    tl.from(elements, {
      opacity: 0,
      y: options.y ?? 30,
      duration: options.duration ?? 0.8,
      stagger: options.stagger ?? 0.1,
      delay: options.delay ?? 0,
      ease: "power2.out",
    });

    return () => {
      tl.kill();
    };
  }, [selector, options.stagger, options.duration, options.y, options.delay]);
}

// ============================================================================
// useRevealOnScroll - Reveal elements with various effects
// ============================================================================

export type RevealEffect =
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "scale"
  | "blur";

export function useRevealOnScroll(
  ref: React.RefObject<HTMLElement>,
  effect: RevealEffect = "fade-up",
  options: {
    duration?: number;
    delay?: number;
    ease?: string;
  } = {},
) {
  useEffect(() => {
    const element = ref.current;
    if (!element) return;

    const duration = options.duration ?? 0.8;
    const delay = options.delay ?? 0;
    const ease = options.ease ?? "power2.out";

    let fromVars: gsap.TweenVars = { opacity: 0 };

    switch (effect) {
      case "fade-up":
        fromVars = { opacity: 0, y: 40 };
        break;
      case "fade-down":
        fromVars = { opacity: 0, y: -40 };
        break;
      case "fade-left":
        fromVars = { opacity: 0, x: 40 };
        break;
      case "fade-right":
        fromVars = { opacity: 0, x: -40 };
        break;
      case "scale":
        fromVars = { opacity: 0, scale: 0.8 };
        break;
      case "blur":
        fromVars = { opacity: 0, filter: "blur(10px)" };
        break;
    }

    gsap.set(element, fromVars);

    const tween = gsap.to(element, {
      opacity: 1,
      y: 0,
      x: 0,
      scale: 1,
      filter: "blur(0px)",
      duration,
      delay,
      ease,
      scrollTrigger: {
        trigger: element,
        start: "top 85%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.kill();
    };
  }, [ref, effect, options.duration, options.delay, options.ease]);
}

// ============================================================================
// useStaggeredReveal - Reveal children with stagger
// ============================================================================

export function useStaggeredReveal(
  containerRef: React.RefObject<HTMLElement>,
  childSelector: string,
  options: {
    stagger?: number;
    duration?: number;
    y?: number;
  } = {},
) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const children = container.querySelectorAll(childSelector);
    if (children.length === 0) return;

    gsap.set(children, { opacity: 0, y: options.y ?? 30 });

    const tween = gsap.to(children, {
      opacity: 1,
      y: 0,
      duration: options.duration ?? 0.6,
      stagger: options.stagger ?? 0.1,
      ease: "power2.out",
      scrollTrigger: {
        trigger: container,
        start: "top 80%",
        toggleActions: "play none none reverse",
      },
    });

    return () => {
      tween.kill();
    };
  }, [
    containerRef,
    childSelector,
    options.stagger,
    options.duration,
    options.y,
  ]);
}

// ============================================================================
// useViewTransition - Animated transitions between views
// ============================================================================

export function useViewTransition() {
  const transitionIn = useCallback(
    (
      element: HTMLElement,
      options: { duration?: number; delay?: number } = {},
    ) => {
      return gsap.from(element, {
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: options.duration ?? 0.5,
        delay: options.delay ?? 0,
        ease: "power2.out",
      });
    },
    [],
  );

  const transitionOut = useCallback(
    (
      element: HTMLElement,
      options: { duration?: number; delay?: number } = {},
    ) => {
      return gsap.to(element, {
        opacity: 0,
        scale: 0.95,
        y: -20,
        duration: options.duration ?? 0.3,
        delay: options.delay ?? 0,
        ease: "power2.in",
      });
    },
    [],
  );

  const crossfade = useCallback(
    (
      outElement: HTMLElement,
      inElement: HTMLElement,
      options: { duration?: number } = {},
    ) => {
      const duration = options.duration ?? 0.5;

      const tl = gsap.timeline();

      tl.to(outElement, {
        opacity: 0,
        duration: duration * 0.6,
        ease: "power2.in",
      });

      tl.from(
        inElement,
        {
          opacity: 0,
          duration: duration * 0.6,
          ease: "power2.out",
        },
        "-=0.2",
      );

      return tl;
    },
    [],
  );

  return { transitionIn, transitionOut, crossfade };
}

// ============================================================================
// usePinSection - Pin a section while scrolling through content
// ============================================================================

export function usePinSection(
  sectionRef: React.RefObject<HTMLElement>,
  options: {
    endTrigger?: string | HTMLElement;
    pinSpacing?: boolean;
  } = {},
) {
  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const st = ScrollTrigger.create({
      trigger: section,
      start: "top top",
      end: options.endTrigger
        ? `bottom+=${section.offsetHeight} top`
        : "+=100%",
      pin: true,
      pinSpacing: options.pinSpacing ?? true,
    });

    return () => {
      st.kill();
    };
  }, [sectionRef, options.endTrigger, options.pinSpacing]);
}

// ============================================================================
// Utility: Refresh ScrollTrigger
// ============================================================================

export function refreshScrollTrigger() {
  ScrollTrigger.refresh();
}

// ============================================================================
// Utility: Kill all ScrollTriggers
// ============================================================================

export function killAllScrollTriggers() {
  ScrollTrigger.getAll().forEach((st) => st.kill());
}
