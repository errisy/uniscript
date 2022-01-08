using System.Collections.Generic;

namespace UniRpc
{
    public class IGroupPolicy
    {
        public string Name { get; set; }
        public Dictionary<string, object> Services { get; set; }
    }
    public class IGroupPolicySet : Dictionary<string, IGroupPolicy> { }

    public class IPolicySets : Dictionary<string, IGroupPolicySet> { }

    public static partial class Static
    {
        public static bool GroupAuthorizations(string policy, string group, string service, string method)
        {
            if (policy == "*" && group == "*") return true;
            if (!__PolicySets.ContainsKey(policy)) return false;
            IGroupPolicySet groupPolicySet = __PolicySets[policy];
            if (!groupPolicySet.ContainsKey(group)) return false;
            IGroupPolicy groupPolicy = groupPolicySet[group];
            if (!groupPolicy.Services.ContainsKey(service)) return false;
            var servicePolicy = groupPolicy.Services[service];
            if (servicePolicy == null) return false;
            if (servicePolicy.GetType() == typeof(string) && (servicePolicy as string) == "*")
            {
                return true;
            }
            else if (servicePolicy.GetType() == typeof(string[]))
            {
                return new HashSet<string>(servicePolicy as string[]).Contains(method);
            }
            return false;
        }

        public static bool GroupClausesAuthorize(string groups, string service, string method)
        {
            if (groups.GetType() != typeof(string)) return false;
            foreach (var groupClause in groups.Split(",", System.StringSplitOptions.RemoveEmptyEntries))
            {
                var sections = groupClause.Split('.');
                var policy = sections[0];
                var group = sections[1];
                if (GroupAuthorizations(policy, group, service, method)) return true;
            }
            return false;
        }
    }

}