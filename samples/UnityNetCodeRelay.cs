
using UnityEngine;
using UnityEngine.Networking;
using System.Collections;
using System.Collections.Generic;

using Unity.Netcode;
using System.Net;
using Unity.Netcode.Transports.UNET;

// Sample for unity netcode integration

public class UnityNetCodeRelay : MonoBehaviour
{
    public string AppId = "test";
    public string ServerAddress = "127.0.0.1";
    public string ServerPort = "8080"; // used for auth / match operations not udp relay

    struct RelayResponse {
        public string matchId;
        public bool success;
        public List<string> matches;
    }
    
    public StartServer()
    {
        NetworkManager.Singleton.StartHost();
        m_relay.Host(matchId => Debug.Log(matchId)); // share the matchId for clients to join
    }

    public StartClient(string matchId)
    {
        Join(matchId, success => {
            GetComponent<Unity.Netcode.Transports.UNET.UNetTransport>().ConnectAddress = ServerAddress;
            NetworkManager.Singleton.StartClient();
        });
    }

    public void Host(bool publicMatch, System.Action<string> callback)
    {
        // publicMatch will determine if this match will be visible in List responses
        string body = "{\"appId\":\""+AppId+"\",\"method\":\"create\",\"public\":"+publicMatch+"}";
        StartCoroutine(Post(body, (success, responseString) => {
            if (success && responseString != "")
            {
                RelayResponse res = JsonUtility.FromJson<RelayResponse>(responseString);
                callback(res.matchId);
                return;
            }
            callback("");
        }));
    }

    public void List(System.Action<List<string>> callback)
    {
        string body = "{\"appId\":\""+AppId+"\",\"method\":\"list\"}";
        StartCoroutine(Post(body, (success, responseString) => {
            if (success && responseString != "")
            {
                RelayResponse res = JsonUtility.FromJson<RelayResponse>(responseString);
                callback(res.matches);
                return;
            }
            callback(null);
        }));
    }

    public void Join(string matchId, System.Action<bool> callback)
    {
        string body = "{\"appId\":\""+AppId+"\",\"method\":\"join\",\"matchId\":\""+matchId+"\"}";
        StartCoroutine(Post(body, (success, responseString) => {
            if (success && responseString != "")
            {
                RelayResponse res = JsonUtility.FromJson<RelayResponse>(responseString);
                callback(res.success);
                return;
            }
            callback(false);
        }));
    }

    private IEnumerator Post(string body,  System.Action<bool, string> callback)
    {
        UnityWebRequest www = UnityWebRequest.Put("http://"+ServerAddress+":"+ServerPort, body);

        www.SetRequestHeader("content-type", "application/json");

        www.downloadHandler = new DownloadHandlerBuffer();

        yield return www.SendWebRequest();

        if (www.result != UnityWebRequest.Result.Success)
        {
            Debug.Log(www.error);
            callback(false, "");
        }
        else
        {
            callback(true, www.downloadHandler.text);
        }
    }
}
