import Foundation

/// 날씨 선택지 6종의 표시명·심볼 (term-weather-option).
/// 어떤 선택지를 노출할지는 서버 visibleOptions만 신뢰한다 — 클라이언트 재계산 금지.
/// 아이콘은 이모지 대신 SF Symbol — 폰트 의존 없이 모든 렌더링 환경(위젯 포함)에서 안전하다.
enum WeatherOptionDisplay {
    static func label(for value: String) -> String {
        switch value {
        case "sunny": "맑음"
        case "cloudy": "흐림"
        case "rain": "비"
        case "wind": "바람"
        case "fog": "안개"
        case "snow": "눈"
        default: value
        }
    }

    static func symbol(for value: String) -> String {
        switch value {
        case "sunny": "sun.max.fill"
        case "cloudy": "cloud.fill"
        case "rain": "cloud.rain.fill"
        case "wind": "wind"
        case "fog": "cloud.fog.fill"
        case "snow": "snowflake"
        default: "questionmark.circle"
        }
    }
}

/// 온도 축 4종의 표시명·심볼 (term-temperature-option). 상시 노출, 서버 visibleOptions 신뢰.
enum TemperatureOptionDisplay {
    static func label(for value: String) -> String {
        switch value {
        case "hot": "더움"
        case "warm": "따뜻함"
        case "cool": "시원함"
        case "cold": "추움"
        default: value
        }
    }

    static func symbol(for value: String) -> String {
        switch value {
        case "hot": "thermometer.sun.fill"
        case "warm": "thermometer.medium"
        case "cool": "thermometer.low"
        case "cold": "thermometer.snowflake"
        default: "questionmark.circle"
        }
    }
}
