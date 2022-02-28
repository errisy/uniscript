using System.Threading.Tasks;

namespace UniRpc
{
    public abstract class WebsocketServiceBase
    {
        public WebsocketService __websocketService { get; set; }
        public string __reflection { get; set; }
        public bool __isGeneric { get; set; }
        public string[] __genericArguments { get; set; }
        public abstract void __outgoing(BaseMessage message);
        public string __user { get; set; }
        public string[] __groups { get; set; }
        public abstract Task<BaseMessage> __invoke(BaseMessage message);
    }
}