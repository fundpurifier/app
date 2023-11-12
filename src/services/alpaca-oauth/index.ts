import { requireEnv } from '@/helpers'
import { randomBytes } from 'crypto'
import { OAuthAccessTokenResponse } from './types'

const redirectUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/oauth`

const generateState = (len: number): string => {
  let arr: Uint8Array
  if (typeof window !== 'undefined' && window.crypto) {
    arr = new Uint8Array(len / 2)
    window.crypto.getRandomValues(arr)
  } else {
    arr = new Uint8Array(randomBytes(len / 2))
  }
  return Array.from(arr, dec2hex).join('')
}

const dec2hex = (dec: number): string => {
  return dec.toString(16).padStart(2, '0')
}

class OAuthApi {
  clientId: string
  state = generateState(40)

  constructor(clientId: string) {
    this.clientId = clientId
  }

  // returns redirect URL for user to authorize Amal as an Alpaca OAuth app
  requestAuthorizationUrl(): string {
    return 'https://app.alpaca.markets/oauth/authorize?' + new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: redirectUrl,
      state: this.state,
      scope: 'account:write trading data'
    })
  }

  // on return from Alpaca
  async processOAuthResponse(code: string) {
    // Exchange code for (long-lived) access token
    const data = new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUrl,
      client_id: this.clientId,
      client_secret: requireEnv('ALPACA_CLIENT_SECRET')
    });

    const response = await fetch('https://api.alpaca.markets/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: data.toString()
    })

    if (!response.ok) {
      throw new Error('OAuth request failed');
    }

    const responseData = await response.json();
    const parsedData = OAuthAccessTokenResponse.parse(responseData);

    return parsedData.access_token;
  }
}

export default OAuthApi