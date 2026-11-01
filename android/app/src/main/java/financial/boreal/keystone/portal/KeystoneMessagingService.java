package financial.boreal.keystone.portal;

// KS_ANDROID_STAFF_v1 - every Firebase message for the Android staff app arrives here (the push plugin's own service
// is removed in AndroidManifest.xml so there is exactly one):
//   - Twilio incoming-call messages go to the calling engine (they ring through Android Telecom),
//   - KS-server staff alerts (missed call, voicemail, client message, text, Maya handoff, task due) are data-only
//     messages, drawn here so they show even when the app is closed, then handed to the push plugin so an open
//     portal hears about them too.
// A rotated token goes to the push plugin (the portal re-sends it to KS-server) and to the calling engine (it
// re-registers with Twilio).

import androidx.annotation.NonNull;

import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

import financial.boreal.keystone.portal.voice.VoiceCallManager;

public class KeystoneMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage message) {
        Map<String, String> data = message.getData();
        if (VoiceCallManager.get(this).handleFcm(data)) return;
        super.onMessageReceived(message);
        StaffAlertNotifier.show(this, data, message.getMessageId());
    }

    @Override
    public void onNewToken(@NonNull String token) {
        super.onNewToken(token);
        VoiceCallManager.get(this).onFcmToken(token);
    }
}
