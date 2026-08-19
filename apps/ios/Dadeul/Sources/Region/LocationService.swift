import CoreLocation

/// 위치 1회 획득 — 시군구 판별에만 사용한다.
/// 좌표는 서버가 판별 즉시 폐기하고 저장하지 않는다 (action-region-resolve).
@MainActor
final class LocationService: NSObject {
    enum LocationError: Error {
        case denied
        case unavailable
    }

    private let manager = CLLocationManager()
    private var continuation: CheckedContinuation<CLLocationCoordinate2D, Error>?

    func currentCoordinate() async throws -> CLLocationCoordinate2D {
        manager.delegate = self

        switch manager.authorizationStatus {
        case .denied, .restricted:
            throw LocationError.denied
        case .notDetermined:
            manager.requestWhenInUseAuthorization()
            // 권한 응답은 locationManagerDidChangeAuthorization에서 이어진다
        default:
            break
        }

        return try await withCheckedThrowingContinuation { continuation in
            self.continuation = continuation
            if isAuthorized {
                manager.requestLocation()
            }
        }
    }

    private var isAuthorized: Bool {
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways: true
        default: false
        }
    }

    private func handleAuthorizationChange() {
        guard continuation != nil else { return }
        switch manager.authorizationStatus {
        case .authorizedWhenInUse, .authorizedAlways:
            manager.requestLocation()
        case .denied, .restricted:
            finish(.failure(LocationError.denied))
        default:
            break
        }
    }

    private func finish(_ result: Result<CLLocationCoordinate2D, Error>) {
        continuation?.resume(with: result)
        continuation = nil
    }
}

extension LocationService: CLLocationManagerDelegate {
    nonisolated func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        Task { @MainActor in self.handleAuthorizationChange() }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        let coordinate = locations.first?.coordinate
        Task { @MainActor in
            if let coordinate {
                self.finish(.success(coordinate))
            } else {
                self.finish(.failure(LocationError.unavailable))
            }
        }
    }

    nonisolated func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        Task { @MainActor in self.finish(.failure(LocationError.unavailable)) }
    }
}
