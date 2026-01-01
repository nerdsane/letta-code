import { forwardRef } from 'react';
import type { ComponentSpec } from './types';
import { DSFDialog } from './radix/Dialog';
import { Button } from './primitives/Button';
import { Text } from './primitives/Text';

interface RendererProps {
  spec: ComponentSpec;
  onInteraction: (componentId: string, interactionType: string, data: any, target?: string) => void;
  [key: string]: any; // Allow spreading additional props from Radix asChild
}

export const DynamicRenderer = forwardRef<HTMLElement, RendererProps>(
  ({ spec, onInteraction, ...additionalProps }, ref) => {
    const { type, id } = spec;

    switch (type) {
      case 'Dialog': {
        const { props, children } = spec as any;
        return (
          <DSFDialog
            trigger={
              props.trigger ?
                <DynamicRenderer spec={props.trigger} onInteraction={onInteraction} /> :
                undefined
            }
            title={props.title}
            description={props.description}
            open={props.open}
            onOpenChange={(open) => {
              if (id && props.onOpenChange) {
                onInteraction(id, 'dialog_change', { open }, props.onOpenChange);
              }
            }}
          >
            {children ? (
              Array.isArray(children) ? (
                children.map((child, i) => (
                  <DynamicRenderer key={i} spec={child} onInteraction={onInteraction} />
                ))
              ) : (
                <DynamicRenderer spec={children} onInteraction={onInteraction} />
              )
            ) : null}
          </DSFDialog>
        );
      }

      case 'Button': {
        const { props } = spec as any;
        // Merge onClick from both spec and additionalProps (e.g., from Radix asChild)
        const handleClick = (e: any) => {
          // Call spec's onClick if defined
          if (id && props.onClick) {
            onInteraction(id, 'click', {}, props.onClick);
          }
          // Call additional onClick (e.g., from Dialog.Trigger)
          if (additionalProps.onClick) {
            additionalProps.onClick(e);
          }
        };

        return (
          <Button
            ref={ref as any}
            label={props.label}
            variant={props.variant}
            {...additionalProps}
            onClick={handleClick}
          />
        );
      }

    case 'Text': {
      const { props } = spec as any;
      return (
        <Text
          content={props.content}
          variant={props.variant}
          size={props.size}
          color={props.color}
        />
      );
    }

    case 'Stack': {
      const { props, children } = spec as any;
      return (
        <div
          style={{
            display: 'flex',
            flexDirection: props.direction === 'horizontal' ? 'row' : 'column',
            gap: `${props.spacing || 16}px`
          }}
        >
          {Array.isArray(children) && children.map((child: ComponentSpec, i: number) => (
            <DynamicRenderer key={i} spec={child} onInteraction={onInteraction} />
          ))}
        </div>
      );
    }

    default:
      return (
        <div style={{ color: 'var(--text-tertiary)', padding: '1rem' }}>
          Unknown component type: {type}
        </div>
      );
  }
});

DynamicRenderer.displayName = 'DynamicRenderer';
