import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import TwoFactorVerification from './TwoFactorVerification'
import TwoFactorService from '../services/twoFactorService'

jest.mock('../services/twoFactorService', () => ({
  __esModule: true,
  default: {
    verifyCode: jest.fn(),
  },
}))

describe('TwoFactorVerification', () => {
  it('supports backup code verification from the recovery flow', async () => {
    const verifyCodeMock = jest.mocked(TwoFactorService.verifyCode)
    verifyCodeMock.mockResolvedValue({ verified: true })

    const onSuccess = jest.fn()

    render(
      <TwoFactorVerification
        isOpen
        onClose={jest.fn()}
        onSuccess={onSuccess}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /usar codigo de backup/i }))

    const input = screen.getByPlaceholderText('CODIGO-BACKUP')
    fireEvent.change(input, { target: { value: '12345678' } })
    fireEvent.click(screen.getByRole('button', { name: /verificar codigo de backup/i }))

    await waitFor(() => {
      expect(verifyCodeMock).toHaveBeenCalledWith('12345678')
    })
    expect(onSuccess).toHaveBeenCalled()
  })
})
