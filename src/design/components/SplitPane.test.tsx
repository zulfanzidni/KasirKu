import { Text } from 'react-native';
import { render, screen } from '@testing-library/react-native';
import { SplitPane } from './SplitPane';
import { PHONE_PORTRAIT, setWindow } from '@/screens/testPhone';

/**
 * The one behaviour SplitPane owns: a pane appears only where there is width
 * for it. Everything else in the component is layout, and layout is checked by
 * looking at the phone.
 */

afterAll(() => setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height));

const list = <Text>daftar</Text>;
const detail = <Text>rincian</Text>;

describe('SplitPane', () => {
  it('shows the list alone in portrait, even when a detail is offered', () => {
    setWindow(PHONE_PORTRAIT.width, PHONE_PORTRAIT.height);
    render(<SplitPane list={list} detail={detail} testID="pecah" detailTestID="pecah-detail" />);

    expect(screen.getByText('daftar')).toBeTruthy();
    expect(screen.queryByText('rincian')).toBeNull();
    expect(screen.queryByTestId('pecah-detail')).toBeNull();
  });

  it('puts the detail beside the list once the frame is wide', () => {
    setWindow(891, 411);
    render(<SplitPane list={list} detail={detail} testID="pecah" detailTestID="pecah-detail" />);

    expect(screen.getByText('daftar')).toBeTruthy();
    expect(screen.getByTestId('pecah-detail')).toBeTruthy();
    expect(screen.getByText('rincian')).toBeTruthy();
  });

  it('leaves the list alone in a wide frame when there is nothing to show beside it', () => {
    setWindow(891, 411);
    render(<SplitPane list={list} testID="pecah" detailTestID="pecah-detail" />);

    expect(screen.getByText('daftar')).toBeTruthy();
    expect(screen.queryByTestId('pecah-detail')).toBeNull();
  });
});
