!ifndef nsProcess::FindProcess
  !include "nsProcess.nsh"
!endif

!macro customCheckAppRunning
  # The default current-user check can miss orphaned or elevated processes.
  ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
  ${If} $R0 == 0
    DetailPrint `Closing running "${PRODUCT_NAME}" instances before install...`

    nsExec::Exec '"$SYSDIR\cmd.exe" /c taskkill /im "${APP_EXECUTABLE_FILENAME}" /t'
    Sleep 500

    StrCpy $R1 0
    loop:
      IntOp $R1 $R1 + 1

      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 != 0
        Goto done
      ${EndIf}

      nsExec::Exec '"$SYSDIR\cmd.exe" /c taskkill /f /im "${APP_EXECUTABLE_FILENAME}" /t'
      Sleep 1500

      ${nsProcess::FindProcess} "${APP_EXECUTABLE_FILENAME}" $R0
      ${If} $R0 != 0
        Goto done
      ${EndIf}

      ${If} $R1 > 2
        MessageBox MB_RETRYCANCEL|MB_ICONEXCLAMATION "$(appCannotBeClosed)" /SD IDCANCEL IDRETRY loop
        Quit
      ${EndIf}

      Goto loop

    done:
  ${EndIf}
!macroend