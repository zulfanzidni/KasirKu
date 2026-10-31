import { fireEvent, render, screen } from '@testing-library/react-native';
import { Button } from './Button';
import { TotalBlock } from './TotalBlock';

describe('Button', () => {
  it('fires once per tap', () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} />);
    fireEvent.press(screen.getByText('Bayar'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled, so a double tap cannot create a second sale', () => {
    const onPress = jest.fn();
    render(<Button label="Bayar" onPress={onPress} disabled testID="bayar" />);
    fireEvent.press(screen.getByTestId('bayar'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('announces its disabled state to assistive tech', () => {
    render(<Button label="Bayar" onPress={jest.fn()} disabled testID="bayar" />);
    expect(screen.getByTestId('bayar').props.accessibilityState).toEqual({ disabled: true });
    expect(screen.getByTestId('bayar').props.accessibilityRole).toBe('button');
  });
});

describe('TotalBlock', () => {
  it('prints the amount the way the shop writes it', () => {
    render(<TotalBlock amount={61500} />);
    expect(screen.getByText('61.500')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
  });

  it('labels itself with a default word the owner recognises', () => {
    render(<TotalBlock amount={0} />);
    expect(screen.getByText('Total')).toBeTruthy();
  });
});
