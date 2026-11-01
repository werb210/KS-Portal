package financial.boreal.keystone.portal;

// KS_ANDROID_STAFF_v1 - the "BorealVoice" plugin on Android: the same JavaScript interface as the iPad's
// BorealVoicePlugin.swift (src/native/portalVoip.ts), backed by VoiceCallManager (Twilio Voice Android SDK + Telecom).

import android.Manifest;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import org.json.JSONException;
import org.json.JSONObject;

import java.util.HashMap;
import java.util.Iterator;
import java.util.Map;

import financial.boreal.keystone.portal.voice.VoiceCallManager;

@CapacitorPlugin(
    name = "BorealVoice",
    permissions = { @Permission(alias = BorealVoicePlugin.MICROPHONE, strings = { Manifest.permission.RECORD_AUDIO }) }
)
public class BorealVoicePlugin extends Plugin implements VoiceCallManager.Listener {

    static final String MICROPHONE = "microphone";

    private VoiceCallManager manager;

    @Override
    public void load() {
        manager = VoiceCallManager.get(getContext());
        manager.addListener(this);
    }

    @Override
    protected void handleOnDestroy() {
        if (manager != null) manager.removeListener(this);
        super.handleOnDestroy();
    }

    @Override
    public void onVoiceEvent(String event, JSONObject data) {
        try {
            notifyListeners(event, JSObject.fromJSONObject(data));
        } catch (JSONException ignored) {
            notifyListeners(event, new JSObject());
        }
    }

    private boolean needsMicrophone() {
        return getPermissionState(MICROPHONE) != PermissionState.GRANTED;
    }

    @PluginMethod
    public void register(PluginCall call) {
        if (needsMicrophone()) { requestPermissionForAlias(MICROPHONE, call, "registerAfterPermission"); return; }
        doRegister(call);
    }

    @PermissionCallback
    private void registerAfterPermission(PluginCall call) {
        doRegister(call); // registers either way; without the microphone a call connects but the caller hears nothing
    }

    private void doRegister(PluginCall call) {
        String token = call.getString("accessToken", "");
        if (token == null || token.isEmpty()) {
            JSObject r = new JSObject();
            r.put("registered", false);
            r.put("error", "no_access_token");
            call.resolve(r);
            return;
        }
        manager.register(token, (ok, error) -> {
            JSObject r = new JSObject();
            r.put("registered", ok);
            if (error != null) r.put("error", error);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void unregister(PluginCall call) {
        manager.unregister();
        call.resolve();
    }

    @PluginMethod
    public void mute(PluginCall call) {
        JSObject r = new JSObject();
        r.put("muted", manager.mute(Boolean.TRUE.equals(call.getBoolean("muted", false))));
        call.resolve(r);
    }

    @PluginMethod
    public void speaker(PluginCall call) {
        JSObject r = new JSObject();
        r.put("speaker", manager.speaker(Boolean.TRUE.equals(call.getBoolean("on", false))));
        call.resolve(r);
    }

    @PluginMethod
    public void hangup(PluginCall call) {
        manager.hangup();
        call.resolve();
    }

    @PluginMethod
    public void answer(PluginCall call) {
        manager.answer(call.getString("uuid", null));
        call.resolve();
    }

    @PluginMethod
    public void reject(PluginCall call) {
        manager.reject(call.getString("uuid", null));
        call.resolve();
    }

    @PluginMethod
    public void getState(PluginCall call) {
        try {
            call.resolve(JSObject.fromJSONObject(manager.stateJson()));
        } catch (JSONException e) {
            call.resolve(new JSObject());
        }
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (needsMicrophone()) { requestPermissionForAlias(MICROPHONE, call, "connectAfterPermission"); return; }
        doConnect(call);
    }

    @PermissionCallback
    private void connectAfterPermission(PluginCall call) {
        if (needsMicrophone()) {
            JSObject r = new JSObject();
            r.put("started", false);
            r.put("error", "microphone_denied");
            call.resolve(r);
            return;
        }
        doConnect(call);
    }

    private void doConnect(PluginCall call) {
        Map<String, String> params = new HashMap<>();
        JSObject raw = call.getObject("params", new JSObject());
        if (raw != null) {
            Iterator<String> keys = raw.keys();
            while (keys.hasNext()) {
                String k = keys.next();
                String v = raw.optString(k, "").trim();
                if (!v.isEmpty()) params.put(k, v);
            }
        }
        String label = params.containsKey("To") ? params.get("To") : (params.containsKey("meetingSlug") ? "Meeting room" : "Call");
        manager.connect(call.getString("accessToken", null), params, label == null ? "Call" : label, (ok, error) -> {
            JSObject r = new JSObject();
            r.put("started", ok);
            if (error != null) r.put("error", error);
            call.resolve(r);
        });
    }

    @PluginMethod
    public void sendDigits(PluginCall call) {
        String digits = call.getString("digits", "");
        manager.sendDigits(digits == null ? "" : digits.replaceAll("[^0-9*#wW]", ""));
        call.resolve();
    }
}
