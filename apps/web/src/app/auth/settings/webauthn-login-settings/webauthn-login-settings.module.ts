import { NgModule } from "@angular/core";
import { FormsModule, ReactiveFormsModule } from "@angular/forms";

import { SharedModule } from "../../../shared/shared.module";
import { UserVerificationModule } from "../../shared/components/user-verification";

import { CreateCredentialDialogComponent } from "./create-credential-dialog/create-credential-dialog.component";
import { DeleteCredentialDialogComponent } from "./delete-credential-dialog/delete-credential-dialog.component";
import { WebauthnLoginSettingsComponent } from "./webauthn-login-settings.component";

@NgModule({
  imports: [SharedModule, FormsModule, ReactiveFormsModule, UserVerificationModule],
  declarations: [
    WebauthnLoginSettingsComponent,
    CreateCredentialDialogComponent,
    DeleteCredentialDialogComponent,
  ],
  exports: [WebauthnLoginSettingsComponent],
})
export class WebauthnLoginSettingsModule {}
