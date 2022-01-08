using System.Collections.Generic;
using System.Text.Json;
using Amazon.DynamoDBv2.DataModel;

namespace UniRpc {
    public class IIdentity
    {
        public string sourceIp { get; set; }
    }

    public class IDataFrame
    {
        public string serial { get; set; }
        public long index { get; set; }
        public string data { get; set; }
    }

    public class IWebSocketUser
    {
        public const string Username = "Username";
        public const string Connections = "Connections";
        public const string Groups = "Groups";
        public const string LastVisit = "LastVisit";
        public const string LastConnection = "LastConnection";
    }

    public class IWebSocketConnection
    {
        public const string ConnectionId = "ConnectionId";
        public const string Username = "Username";
        public const string ConnectTime = "ConnectTime";
    }
}