package financial.boreal.keystone.portal.voice;

// KS_ANDROID_STAFF_v1 - Decline (ringing) and Hang up (ongoing) from the call notifications. Neither opens a screen.

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {

    static final String ACTION_DECLINE = "financial.boreal.keystone.portal.voice.DECLINE";
    static final String ACTION_HANGUP = "financial.boreal.keystone.portal.voice.HANGUP";

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent == null ? null : intent.getAction();
        VoiceCallManager manager = VoiceCallManager.get(context);
        if (ACTION_DECLINE.equals(action)) manager.reject(null);
        else if (ACTION_HANGUP.equals(action)) manager.hangup();
    }
}
