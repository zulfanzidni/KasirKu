import Svg, { Path } from 'react-native-svg';
import { colors } from '../tokens';
import { iconData, type IconName } from './iconData';

export type { IconName };

export interface IconProps {
  name: IconName;
  /** The box the icon is drawn in, in dp. The kit's own canvas scales into it. */
  size?: number;
  /** Tint. One weight, one colour: an icon is never two tones in this app. */
  color?: string;
  /** Override the kit's 1.5 stroke, in the kit's 32-unit canvas. */
  strokeWidth?: number;
  testID?: string;
}

/**
 * One icon, from the Vuesax linear set the design system names (DESIGN.md
 * Icons), ported from `Icon.figcraft`.
 *
 * The kit draws on a 32-unit canvas with a 1.5 stroke; scaling that canvas into
 * a 24 dp box is exactly what the FigCraft instances do, so a `size` here
 * reproduces the design file rather than approximating it.
 */
export function Icon({ name, size = 24, color = colors.onSurfaceVariant, strokeWidth, testID }: IconProps) {
  const icon = iconData[name];

  return (
    <Svg
      testID={testID}
      width={size}
      height={size}
      viewBox={icon.viewBox}
      fill="none"
      accessibilityElementsHidden
      importantForAccessibility="no"
    >
      {icon.paths.map((path, index) => {
        const filled = 'filled' in path && path.filled;
        return (
          <Path
            key={index}
            d={path.d}
            transform={path.translate ? `translate(${path.translate[0]}, ${path.translate[1]})` : undefined}
            fill={filled ? color : 'none'}
            stroke={filled ? 'none' : color}
            strokeWidth={strokeWidth ?? path.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })}
    </Svg>
  );
}
