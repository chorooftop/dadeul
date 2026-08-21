import { afterEach, describe, expect, it, vi } from 'vitest'
import { KakaoRegionResolver, UnconfiguredRegionResolver } from '../src/services/regions.js'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('KakaoRegionResolver', () => {
  it('200 응답에서 법정동 시군구를 파싱한다', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          documents: [
            {
              region_type: 'H',
              code: '1168066000',
              region_1depth_name: '서울특별시',
              region_2depth_name: '강남구',
            },
            {
              region_type: 'B',
              code: '1168010100',
              region_1depth_name: '서울특별시',
              region_2depth_name: '강남구',
            },
          ],
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const resolver = new KakaoRegionResolver('test-rest-api-key')
    await expect(resolver.resolve(37.4979, 127.0276)).resolves.toEqual({
      code: '11680',
      name: '강남구',
      fullName: '서울특별시 강남구',
    })

    const [url, init] = fetchMock.mock.calls[0] as unknown as [URL, RequestInit]
    expect(url.searchParams.get('x')).toBe('127.0276')
    expect(url.searchParams.get('y')).toBe('37.4979')
    expect(init.headers).toEqual({ Authorization: 'KakaoAK test-rest-api-key' })
  })

  it('카카오 쿼터 초과 429를 INTERNAL_ERROR/503으로 변환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 429 })))

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 503,
      message: 'kakao coord2regioncode quota exhausted (upstream 429)',
    })
  })

  it.each([401, 403])(
    '카카오 credential 오류 %i를 INTERNAL_ERROR/502로 변환한다',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })))

      await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
        token: 'INTERNAL_ERROR',
        statusCode: 502,
        message: `kakao coord2regioncode credential rejected (upstream ${status})`,
      })
    },
  )

  // 실측(2026-08-22): 해외 좌표에 카카오는 400 + code -2를 준다. 장애가 아니라 판별 불가다
  it('서비스 지역 밖 좌표(400 code -2)를 판별 불가(null)로 처리한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ code: -2, msg: 'The input parameter value is not in the service area' }),
          { status: 400, headers: { 'content-type': 'application/json' } },
        ),
      ),
    )

    await expect(new KakaoRegionResolver('key').resolve(35.6762, 139.6503)).resolves.toBeNull()
  })

  it('서비스 지역 밖이 아닌 400은 INTERNAL_ERROR/502로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ code: -1, msg: 'bad request' }), {
          status: 400,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 502,
      message: 'kakao coord2regioncode failed (upstream 400)',
    })
  })

  it('그 밖의 카카오 비정상 응답을 INTERNAL_ERROR/502로 변환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 500 })))

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 502,
      message: 'kakao coord2regioncode failed (upstream 500)',
    })
  })

  it('카카오 네트워크 실패를 INTERNAL_ERROR/502로 변환한다', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fetch failed')))

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 502,
      message: 'kakao coord2regioncode request failed',
    })
  })

  it('카카오의 비정상 JSON 응답을 INTERNAL_ERROR/502로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('not-json', { status: 200, headers: { 'content-type': 'application/json' } }),
      ),
    )

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 502,
      message: 'kakao coord2regioncode invalid JSON',
    })
  })

  it('카카오의 비정상 응답 구조를 INTERNAL_ERROR/502로 변환한다', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ documents: 'invalid' }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    )

    await expect(new KakaoRegionResolver('key').resolve(37.5, 127)).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 502,
      message: 'kakao coord2regioncode invalid response',
    })
  })
})

describe('UnconfiguredRegionResolver', () => {
  it('키 미설정 시 INTERNAL_ERROR/503을 반환한다', async () => {
    await expect(new UnconfiguredRegionResolver().resolve()).rejects.toMatchObject({
      token: 'INTERNAL_ERROR',
      statusCode: 503,
      message: 'region resolver unconfigured — set KAKAO_REST_API_KEY',
    })
  })
})
