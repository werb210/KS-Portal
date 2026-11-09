// BF_PORTAL_WIDGET_v29
import AppIntents
import WidgetKit

enum MetricChoice: String, AppEnum {
    case pipeline, tasksDueToday, unreadMessages, commissionEarned
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Metric"
    static var caseDisplayRepresentations: [MetricChoice: DisplayRepresentation] = [
        .pipeline: "Pipeline", .tasksDueToday: "Tasks Due Today",
        .unreadMessages: "Unread Messages", .commissionEarned: "Commission Earned"
    ]
    var metric: WidgetMetric { WidgetMetric(rawValue: rawValue)! }
}

enum SiloChoice: String, AppEnum {
    // KS_PORTAL_OWN_APP_ID_v1 - Keystone has no silos, so the widget always follows the portal.
    case followApp
    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Business"
    static var caseDisplayRepresentations: [SiloChoice: DisplayRepresentation] = [
        .followApp: "Follow the portal"
    ]
    var silo: WidgetSilo { WidgetSilo(rawValue: WidgetStore.silo ?? "BF") ?? .bf }
}

struct SummaryConfiguration: WidgetConfigurationIntent {
    static var title: LocalizedStringResource = "Keystone Portal"
    static var description = IntentDescription("Pick what each tile shows.")
    @Parameter(title: "Business", default: .followApp) var silo: SiloChoice
    @Parameter(title: "First", default: .pipeline) var first: MetricChoice
    @Parameter(title: "Second", default: .tasksDueToday) var second: MetricChoice
    @Parameter(title: "Third", default: .unreadMessages) var third: MetricChoice
    @Parameter(title: "Fourth", default: .commissionEarned) var fourth: MetricChoice
    var metrics: [WidgetMetric] { [first.metric, second.metric, third.metric, fourth.metric] }
}
