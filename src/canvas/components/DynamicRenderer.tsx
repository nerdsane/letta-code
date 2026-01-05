import { forwardRef } from 'react';
import type { ComponentSpec } from './types';
import { DSFDialog } from './radix/Dialog';
import { Button } from './primitives/Button';
import { Text } from './primitives/Text';
import { Image } from './primitives/Image';
import { Gallery } from './primitives/Gallery';
import { Card } from './primitives/Card';
import { Timeline } from './primitives/Timeline';
import { Callout } from './primitives/Callout';
import { Stats } from './primitives/Stats';
import { Badge } from './primitives/Badge';
import { Divider } from './primitives/Divider';
import { Stack } from './layout/Stack';
import { Grid } from './layout/Grid';

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
        const handleClick = (e: any) => {
          if (id && props.onClick) {
            onInteraction(id, 'click', {}, props.onClick);
          }
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
          <Stack
            direction={props?.direction}
            spacing={props?.spacing}
            align={props?.align}
            justify={props?.justify}
            wrap={props?.wrap}
          >
            {Array.isArray(children) && children.map((child: ComponentSpec, i: number) => (
              <DynamicRenderer key={i} spec={child} onInteraction={onInteraction} />
            ))}
          </Stack>
        );
      }

      case 'Grid': {
        const { props, children } = spec as any;
        return (
          <Grid
            columns={props?.columns}
            rows={props?.rows}
            gap={props?.gap}
            columnGap={props?.columnGap}
            rowGap={props?.rowGap}
            minChildWidth={props?.minChildWidth}
            align={props?.align}
            justify={props?.justify}
          >
            {Array.isArray(children) && children.map((child: ComponentSpec, i: number) => (
              <DynamicRenderer key={i} spec={child} onInteraction={onInteraction} />
            ))}
          </Grid>
        );
      }

      case 'Image': {
        const { props } = spec as any;
        return (
          <Image
            src={props.src}
            alt={props.alt}
            caption={props.caption}
            size={props.size}
            lightbox={props.lightbox}
            onClick={props.onClick ? () => {
              if (id) onInteraction(id, 'click', {}, props.onClick);
            } : undefined}
          />
        );
      }

      case 'Gallery': {
        const { props } = spec as any;
        return (
          <Gallery
            images={props.images || []}
            columns={props.columns}
            gap={props.gap}
            lightbox={props.lightbox}
            variant={props.variant}
          />
        );
      }

      case 'Card': {
        const { props, children } = spec as any;
        return (
          <Card
            title={props.title}
            subtitle={props.subtitle}
            image={props.image}
            imagePosition={props.imagePosition}
            variant={props.variant}
            accent={props.accent}
            onClick={props.onClick ? () => {
              if (id) onInteraction(id, 'click', {}, props.onClick);
            } : undefined}
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
          </Card>
        );
      }

      case 'Timeline': {
        const { props } = spec as any;
        return (
          <Timeline
            events={props.events || []}
            orientation={props.orientation}
            variant={props.variant}
            showConnectors={props.showConnectors}
          />
        );
      }

      case 'Callout': {
        const { props, children } = spec as any;
        return (
          <Callout
            variant={props.variant}
            title={props.title}
            content={props.content}
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
          </Callout>
        );
      }

      case 'Stats': {
        const { props } = spec as any;
        return (
          <Stats
            items={props.items || []}
            columns={props.columns}
            variant={props.variant}
          />
        );
      }

      case 'Badge': {
        const { props } = spec as any;
        return (
          <Badge
            label={props.label}
            variant={props.variant}
            size={props.size}
            icon={props.icon}
          />
        );
      }

      case 'Divider': {
        const { props } = spec as any;
        return (
          <Divider
            variant={props?.variant}
            spacing={props?.spacing}
            label={props?.label}
          />
        );
      }

      default:
        return (
          <div style={{ color: 'var(--text-tertiary)', padding: '1rem' }}>
            Unknown component type: {type}
          </div>
        );
    }
  }
);

DynamicRenderer.displayName = 'DynamicRenderer';
