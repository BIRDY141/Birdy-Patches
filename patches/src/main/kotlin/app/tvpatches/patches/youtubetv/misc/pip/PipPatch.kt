package app.tvpatches.patches.youtubetv.misc.pip

import app.morphe.patcher.extensions.InstructionExtensions.addInstruction
import app.morphe.patcher.extensions.InstructionExtensions.addInstructions
import app.morphe.patcher.patch.bytecodePatch
import app.morphe.patcher.patch.resourcePatch
import app.morphe.patcher.patch.resourceXml
import app.tvpatches.patches.youtubetv.misc.gms.CobaltActivityOnCreateFingerprint
import app.tvpatches.patches.youtubetv.misc.gms.youtubeTvExtensionPatch
import app.tvpatches.patches.youtubetv.shared.Constants.COMPATIBILITY_YOUTUBE_TV
import com.android.tools.smali.dexlib2.AccessFlags
import com.android.tools.smali.dexlib2.builder.MutableMethodImplementation
import com.android.tools.smali.dexlib2.immutable.ImmutableMethod
import app.morphe.patcher.util.proxy.mutableTypes.MutableMethod.Companion.toMutable

private const val PIP_HELPER = "Lapp/tvpatches/extension/youtubetv/PipHelper;"
private val REQUIRED_CONFIG_CHANGES = listOf("screenSize", "smallestScreenSize", "screenLayout", "orientation")

private val pipResourcePatch = resourcePatch {
    execute {
        resourceXml("AndroidManifest.xml").use { manifest ->
            val app = manifest.root.elements("application").firstOrNull() ?: return@use
            app.elements("activity").forEach { activity ->
                val name = activity.attribute("android:name") ?: ""
                if (name.contains("MainActivity") || name.contains("StandalonePlayerActivity")) {
                    activity.setAttribute("android:supportsPictureInPicture", "true")
                    activity.setAttribute("android:resizeableActivity", "true")
                    val existing = (activity.attribute("android:configChanges") ?: "")
                        .split("|")
                        .map { it.trim() }
                        .filter { it.isNotEmpty() }
                        .toMutableSet()
                    existing.addAll(REQUIRED_CONFIG_CHANGES)
                    activity.setAttribute("android:configChanges", existing.joinToString("|"))
                }
            }
        }
    }
}

@Suppress("unused")
val pipPatch = bytecodePatch(
    name = "Picture-in-Picture (PiP)",
    description = "Enables Android TV Picture-in-Picture mode when pressing Home while a video is playing.",
    default = true,
) {
    compatibleWith(COMPATIBILITY_YOUTUBE_TV)
    dependsOn(youtubeTvExtensionPatch, pipResourcePatch)

    execute {
        CobaltActivityOnCreateFingerprint.method.addInstruction(
            0,
            "invoke-static/range { p0 .. p0 }, $PIP_HELPER->setActivity(Landroid/app/Activity;)V",
        )

        val cobaltClass = CobaltActivityOnCreateFingerprint.classDef
        val existingLeaveHint = cobaltClass.methods.firstOrNull {
            it.name == "onUserLeaveHint" && it.parameters.isEmpty() && it.returnType == "V"
        }

        if (existingLeaveHint != null) {
            existingLeaveHint.addInstruction(
                0,
                "invoke-static/range { p0 .. p0 }, $PIP_HELPER->onUserLeaveHint(Landroid/app/Activity;)V",
            )
        } else {
            val superType = cobaltClass.superclass ?: "Landroid/app/Activity;"
            cobaltClass.methods.add(
                ImmutableMethod(
                    cobaltClass.type,
                    "onUserLeaveHint",
                    emptyList(),
                    "V",
                    AccessFlags.PUBLIC.value,
                    null,
                    null,
                    MutableMethodImplementation(2),
                ).toMutable().apply {
                    addInstructions(
                        0,
                        """
                            invoke-super { p0 }, $superType->onUserLeaveHint()V
                            invoke-static { p0 }, $PIP_HELPER->onUserLeaveHint(Landroid/app/Activity;)V
                            return-void
                        """,
                    )
                },
            )
        }
    }
}
