import {OnInit, OnDestroy, ElementRef, ViewChild, Inject, ChangeDetectorRef} from "@angular/core";
import {FORM_DIRECTIVES} from "@angular/common";
import {IMessageService, IThreadService, IUserService} from "../../services/services";
import {User, Thread, Message} from "../../models/models";
import {Page, NavParams, Content} from "ionic-angular/index";
import {ChatMessageComp} from "./chat-message.comp";
import {uuid} from "../../util/uuid";
import {Subscription} from "rxjs/Subscription";
import {Logger} from "log4javascript/log4javascript";
import {loggerToken} from "../../services/log.service";
@Page({
  selector: 'chat-window',
  directives: [ChatMessageComp, FORM_DIRECTIVES],
  templateUrl: 'build/pages/chats-tab/chat-window.page.html'
})
export class ChatWindowPage implements OnInit, OnDestroy {
  @ViewChild(Content) content:Content;
  currentThread:Thread;
  messageInfos:MessageInfo[] = [];
  subscription:Subscription;
  draftMessageText:string;

  me:User;
  cacheAuthors:{[id:string]:User} = {}
  cacheMessages:{[id:string]:Message} = {};
  constructor(private messagesService:IMessageService,
              private threadsService:IThreadService,
              private userService:IUserService,
              private el:ElementRef, private params:NavParams,
              @Inject(loggerToken) private logger:Logger,
              private cd:ChangeDetectorRef) {
    this.currentThread = params.data.thread;
  }

  ngOnInit():void {
    this.userService.promiseMe().then((me:User)=> {
      this.me = me;
    });
    this.subscription = this.messagesService.observableMessagesByThreadId(
        this.currentThread.id).subscribe((messages:Message[]) => {
      let diffMessages:Message[] = [];
      for (let m of messages) {
        if (!this.cacheMessages[m.id]) {
          diffMessages.push(m);
          this.cacheMessages[m.id] = m;
        }
      }
      let promises:Promise<User>[] = [];
      for (let m:Message of diffMessages) {
        if (!this.cacheAuthors[m.authorId]) {
          promises.push(this.userService.observableUserById(m.authorId).take(1).toPromise());
        }
      }
      Promise.all(promises).then((users:User[]) => {
        users.map((user:User)=> {
          this.cacheAuthors[user.id] = user;
        });
      }).then(()=> {
        let diffMessageInfos:MessageInfo[] = [];
        for (let m:Message of diffMessages) {
          diffMessageInfos.push(<MessageInfo>{
            message: m,
            author: this.cacheAuthors[m.authorId],
            incoming: m.authorId != this.me.id
          });
        }
        this.messageInfos = this.messageInfos.concat(diffMessageInfos);
        this.cd.detectChanges();
        this.scrollToBottom();
      });
    });
  }

  ngOnDestroy():void {
    if (this.subscription) this.subscription.unsubscribe();
  }

  onEnter(event:any):void {
    this.sendMessage();
  }

  sendMessage():void {
    let m:Message = new Message(uuid(), this.draftMessageText, new Date(), this.me.id, this.currentThread.id);
    this.messagesService.createMessage(m);
    this.draftMessageText = "";
    this.scrollToBottom();
  }

  private scrollToBottom():void {
    let dimensions = this.content.getContentDimensions();
    this.content.scrollTo(0, dimensions.scrollBottom, 0);
  }
}

class MessageInfo {
  message:Message;
  author:User;
  incoming:boolean;
}