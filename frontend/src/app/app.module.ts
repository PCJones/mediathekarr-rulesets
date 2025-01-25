import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { HttpClientModule, HTTP_INTERCEPTORS } from '@angular/common/http';
import { RouterModule, Routes } from '@angular/router';

import { AppComponent } from './app.component';
import { LoginComponent } from './components/login/login.component';
import { MediaListComponent } from './components/media-list/media-list.component';
import { RulesetComponent } from './components/ruleset/ruleset.component';
import { ThemeToggleComponent } from './components/theme-toggle/theme-toggle.component';

import { RulesetFilterComponent } from './components/ruleset/ruleset-filter.component';
import { RegexRuleComponent } from './components/ruleset/regex-rule.component';
import { RulesetListComponent } from './components/ruleset/ruleset-list.component';

import { AuthService } from './services/auth.service';
import { MediaService } from './services/media.service';
import { RulesetService } from './services/ruleset.service';
import { AuthInterceptor } from './interceptors/auth.interceptor';
import { AuthGuard } from './guards/auth.guard';
import { RulesetHeaderComponent } from './components/ruleset/ruleset-header.component';
import { RulesetFormComponent } from './components/ruleset/ruleset-form.component';
import { JsonEditorComponent } from './components/ruleset/json-editor.component';

const routes: Routes = [
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'media', component: MediaListComponent, canActivate: [AuthGuard] },
  { path: 'rulesets/:mediaId', component: RulesetComponent, canActivate: [AuthGuard] },
  { path: '**', redirectTo: '/login' }
];

@NgModule({
  declarations: [
    AppComponent,
    LoginComponent,
    MediaListComponent,
    RulesetComponent,
    ThemeToggleComponent,
    RulesetFilterComponent, 
    RegexRuleComponent,     
    RulesetListComponent,
    RulesetHeaderComponent,
    RulesetFormComponent,
    JsonEditorComponent,
  ],
  imports: [
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    ReactiveFormsModule,
    HttpClientModule,
    RouterModule.forRoot(routes, { 
      enableTracing: true, 
      useHash: true 
    })
  ],
  providers: [
    AuthService,
    MediaService,
    RulesetService,
    AuthGuard,
    {
      provide: HTTP_INTERCEPTORS,
      useClass: AuthInterceptor,
      multi: true
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }