import CoreText
import SwiftUI

/// 디자인 토큰 — specs/design-concept.md 컬러 표·타이포 스케일이 진실.
/// 시안 원본은 design/ 캔버스(라이트 단일 테마, 다크는 후속 결정).
enum DesignToken {
    // MARK: - 컬러 (라이트 단일 테마)

    /// 화면 배경 #F5F6F8
    static let bg = Color(red: 0xF5 / 255, green: 0xF6 / 255, blue: 0xF8 / 255)
    /// 카드·위젯 표면 #FFFFFF
    static let surface = Color.white
    /// 카드 보더, 바 트랙 #E8EBF0
    static let stroke = Color(red: 0xE8 / 255, green: 0xEB / 255, blue: 0xF0 / 255)
    /// 본문·수치 텍스트 #17181C
    static let ink = Color(red: 0x17 / 255, green: 0x18 / 255, blue: 0x1C / 255)
    /// 보조 텍스트 (라벨, 참여 수) #6B7280
    static let inkSub = Color(red: 0x6B / 255, green: 0x72 / 255, blue: 0x80 / 255)
    /// 삼차 텍스트 ("n분 전") #9AA1AC
    static let inkTer = Color(red: 0x9A / 255, green: 0xA1 / 255, blue: 0xAC / 255)
    /// 프라이머리 — 1위 바·수치, 선택 상태, 순위 뱃지 #3D7BFF
    static let sky = Color(red: 0x3D / 255, green: 0x7B / 255, blue: 0xFF / 255)
    /// 선택 칩 배경, 1위 행 하이라이트 #EAF1FF
    static let skyTint = Color(red: 0xEA / 255, green: 0xF1 / 255, blue: 0xFF / 255)
    /// 크레딧, 참여 유도(표본 미달) #FFB324
    static let amber = Color(red: 0xFF / 255, green: 0xB3 / 255, blue: 0x24 / 255)
}

/// Pretendard 타이포 — 앱 번들(SIL OFL). 스케일은 design-concept.md 표 그대로.
enum DesignFont {
    static func regular(_ size: CGFloat) -> Font { .custom("Pretendard-Regular", size: size) }
    static func medium(_ size: CGFloat) -> Font { .custom("Pretendard-Medium", size: size) }
    static func bold(_ size: CGFloat) -> Font { .custom("Pretendard-Bold", size: size) }
    static func extraBold(_ size: CGFloat) -> Font { .custom("Pretendard-ExtraBold", size: size) }

    /// 화면 타이틀 (지역명) — 24 ExtraBold
    static let screenTitle = extraBold(24)
    /// 카드 제목 — 17 Bold
    static let cardTitle = bold(17)
    /// 본문·선택지 — 14 Medium
    static let body = medium(14)
    /// 캡션 (참여·시각) — 12 Regular
    static let caption = regular(12)
    /// 캡션 소 — 11 Regular
    static let captionSmall = regular(11)

    /// 앱·위젯 익스텐션 공용 폰트 등록 — 프로세스당 1회 호출.
    /// UIAppFonts 대신 프로그램 등록을 쓰는 이유: 앱 타깃이 GENERATE_INFOPLIST_FILE로
    /// plist를 생성하므로 번들 리소스 등록만으로 양쪽 타깃에서 동작한다.
    static func register() {
        for name in ["Pretendard-Regular", "Pretendard-Medium", "Pretendard-Bold", "Pretendard-ExtraBold"] {
            guard let url = Bundle.main.url(forResource: name, withExtension: "otf") else {
                assertionFailure("폰트 리소스 누락: \(name).otf")
                continue
            }
            // 중복 등록(이미 등록됨 에러)은 무해 — 결과를 무시한다
            CTFontManagerRegisterFontsForURL(url as CFURL, .process, nil)
        }
    }
}
