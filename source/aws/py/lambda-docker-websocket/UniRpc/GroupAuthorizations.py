from typing import TypedDict, Union, List, Dict
from UniRpc.GroupAuthorizationPolicies import __PolicySets


class IGroupPolicy(TypedDict):
    Name: str
    Services: Dict[str, Union[str, List[str]]]


IGroupPolicySet = Dict[str, IGroupPolicy]

IPolicySets = Dict[str, IGroupPolicySet]


def GroupAuthorizations(policy: str, group: str, service: str, method: str) -> bool:
    if policy == '*' and group == '*':
        return True
    if policy not in __PolicySets.keys():
        return False
    groupPolicySet: IGroupPolicySet = __PolicySets[policy]
    if group not in groupPolicySet.keys():
        return False
    groupPolicy: IGroupPolicy = groupPolicySet[group]
    services = groupPolicy['Services']
    if service not in services.keys():
        return False
    servicePolicy: Union[str, List[str]] = services[service]
    if isinstance(servicePolicy, str) and servicePolicy == '*':
        return True
    if isinstance(servicePolicy, list) and servicePolicy.includes(method):
        return True
    return False


def GroupClausesAuthorize(groups: List[str], service: str, method: str) -> bool:
    if not isinstance(groups, list):
        return False
    for groupClause in groups:
        sections = groupClause.split('.')
        policy = sections[0]
        group = sections[1]
        if GroupAuthorizations(policy, group, service, method):
            return True
    return False
