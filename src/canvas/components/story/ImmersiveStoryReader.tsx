import { useEffect, useRef, useState } from 'react';
import { StoryHero } from './StoryHero';
import { StorySection } from './StorySection';
import { InlineMedia } from './InlineMedia';
import { WorldContext } from './WorldContext';
import { StoryActions } from './StoryActions';
import './immersive.css';

// Story content types
export interface StoryContent {
  type: 'text' | 'image' | 'gallery' | 'world-context' | 'divider';
  content?: string;
  src?: string;
  images?: Array<{ src: string; alt?: string; caption?: string }>;
  contextType?: 'rule' | 'character' | 'location' | 'tech';
  title?: string;
  description?: string;
  fullBleed?: boolean;
}

export interface StoryData {
  id: string;
  title: string;
  subtitle?: string;
  heroImage?: string;
  worldName?: string;
  chapterNumber?: number;
  totalChapters?: number;
  readTime?: string;
  content: StoryContent[];
  actions?: {
    canContinue?: boolean;
    branches?: Array<{ id: string; label: string; preview?: string }>;
  };
}

interface ImmersiveStoryReaderProps {
  story: StoryData;
  onContinue?: () => void;
  onBranch?: (branchId: string) => void;
  onWorldExplore?: () => void;
}

export function ImmersiveStoryReader({
  story,
  onContinue,
  onBranch,
  onWorldExplore
}: ImmersiveStoryReaderProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [visibleSections, setVisibleSections] = useState<Set<number>>(new Set([0]));

  // Track scroll progress for parallax effects
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const scrollHeight = container.scrollHeight - container.clientHeight;
      const progress = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
      setScrollProgress(progress);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  // Intersection Observer for scroll-triggered animations
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries: IntersectionObserverEntry[]) => {
        entries.forEach((entry: IntersectionObserverEntry) => {
          const index = parseInt(entry.target.getAttribute('data-section-index') || '0', 10);
          setVisibleSections((prev) => {
            const next = new Set(prev);
            if (entry.isIntersecting) {
              next.add(index);
            }
            return next;
          });
        });
      },
      {
        root: containerRef.current,
        rootMargin: '-10% 0px -10% 0px',
        threshold: [0, 0.1, 0.5, 1]
      }
    );

    const container = containerRef.current;
    if (container) {
      const sections = container.querySelectorAll('[data-section-index]');
      sections.forEach((section: Element) => observer.observe(section));
    }

    return () => observer.disconnect();
  }, [story.content]);

  return (
    <div
      ref={containerRef}
      className="immersive-reader"
      style={{ '--scroll-progress': scrollProgress } as React.CSSProperties}
    >
      {/* Atmospheric background layer */}
      <div className="immersive-atmosphere" />

      {/* Progress indicator */}
      <div className="immersive-progress">
        <div
          className="immersive-progress-bar"
          style={{ transform: `scaleX(${scrollProgress})` }}
        />
      </div>

      {/* Hero section */}
      <StoryHero
        title={story.title}
        subtitle={story.subtitle}
        heroImage={story.heroImage}
        worldName={story.worldName}
        chapterInfo={
          story.chapterNumber && story.totalChapters
            ? `Chapter ${story.chapterNumber} of ${story.totalChapters}`
            : undefined
        }
        readTime={story.readTime}
        scrollProgress={scrollProgress}
        onWorldClick={onWorldExplore}
      />

      {/* Story content */}
      <div className="immersive-content">
        {story.content.map((item, index) => {
          const isVisible = visibleSections.has(index);
          const sectionProps = {
            'data-section-index': index,
            className: `immersive-section ${isVisible ? 'visible' : ''}`
          };

          switch (item.type) {
            case 'text':
              return (
                <StorySection
                  key={index}
                  {...sectionProps}
                  content={item.content || ''}
                  isVisible={isVisible}
                  index={index}
                />
              );

            case 'image':
              return (
                <InlineMedia
                  key={index}
                  {...sectionProps}
                  type="image"
                  src={item.src}
                  caption={item.description}
                  fullBleed={item.fullBleed}
                  isVisible={isVisible}
                />
              );

            case 'gallery':
              return (
                <InlineMedia
                  key={index}
                  {...sectionProps}
                  type="gallery"
                  images={item.images}
                  isVisible={isVisible}
                />
              );

            case 'world-context':
              return (
                <WorldContext
                  key={index}
                  {...sectionProps}
                  contextType={item.contextType || 'rule'}
                  title={item.title}
                  content={item.content || item.description}
                  isVisible={isVisible}
                />
              );

            case 'divider':
              return (
                <div
                  key={index}
                  {...sectionProps}
                  className={`immersive-divider ${isVisible ? 'visible' : ''}`}
                >
                  <span className="divider-ornament">✦</span>
                </div>
              );

            default:
              return null;
          }
        })}

        {/* Story actions */}
        {story.actions && (
          <StoryActions
            canContinue={story.actions.canContinue}
            branches={story.actions.branches}
            onContinue={onContinue}
            onBranch={onBranch}
          />
        )}

        {/* End flourish */}
        <div className="immersive-end">
          <div className="end-ornament">
            <span>◆</span>
            <span>◇</span>
            <span>◆</span>
          </div>
        </div>
      </div>
    </div>
  );
}
