// Component specification types for dynamic rendering

export interface BaseComponentSpec {
  type: string;
  id?: string;
}

export interface DialogSpec extends BaseComponentSpec {
  type: 'Dialog';
  props: {
    title?: string;
    description?: string;
    trigger?: ComponentSpec;
    open?: boolean;
    onOpenChange?: string; // event handler name
  };
  children?: ComponentSpec | ComponentSpec[];
}

export interface ButtonSpec extends BaseComponentSpec {
  type: 'Button';
  props: {
    label: string;
    variant?: 'primary' | 'secondary';
    onClick?: string; // event handler name
  };
}

export interface TextSpec extends BaseComponentSpec {
  type: 'Text';
  props: {
    content: string;
    variant?: 'body' | 'heading' | 'caption';
    size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
    color?: string;
  };
}

export interface StackSpec extends BaseComponentSpec {
  type: 'Stack';
  props: {
    spacing?: number;
    direction?: 'vertical' | 'horizontal';
  };
  children?: ComponentSpec[];
}

export type ComponentSpec =
  | DialogSpec
  | ButtonSpec
  | TextSpec
  | StackSpec;

export interface CanvasState {
  rootComponent: ComponentSpec | null;
  version: number;
}
