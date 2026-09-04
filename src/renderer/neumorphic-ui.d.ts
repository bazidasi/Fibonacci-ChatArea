/// <reference types="react" />
//
// Minimal type declarations for the `neumorphic-ui` package
// (https://github.com/dev-saeed/neumorphic-ui — listed in awesome-neumorphism).
// The package ships no TypeScript definitions.
declare module 'neumorphic-ui' {
  import { Component, type ReactNode } from 'react'

  export interface NeuButtonProps {
    text?: ReactNode
    hovered?: boolean
    clicked?: boolean
    mouseOver?: () => void
    mouseOut?: () => void
    onClick?: () => void
    width?: string
    height?: string
  }

  export class NeuButton extends Component<NeuButtonProps> {}

  export interface NeuCardProps {
    width?: string
    height?: string
    children?: ReactNode
  }

  export class NeuCard extends Component<NeuCardProps> {}

  export interface NeuInputProps {
    width?: string
    height?: string
    placeholder?: string
    type?: string
    onChange?: (value: string) => void
  }

  export class NeuInput extends Component<NeuInputProps> {}

  export interface NeuHeadingProps {
    children?: ReactNode
    size?: string
  }

  export class NeuHeading extends Component<NeuHeadingProps> {}

  export interface NeuProgressBarProps {
    value?: number
    height?: string
    width?: string
  }

  export class NeuProgressBar extends Component<NeuProgressBarProps> {}
}
